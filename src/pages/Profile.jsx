import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabaseClient';
import {
  User,
  Camera,
  LogOut,
  Trash2,
  Lock,
  Compass,
  CheckCircle,
  AlertOctagon,
} from 'lucide-react';

export default function Profile() {
  const { profile, user, updateProfile, signOut, resetPassword } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName) {
      toastError('Name cannot be empty');
      return;
    }

    setUpdating(true);
    const { error } = await updateProfile({ full_name: fullName });
    setUpdating(false);

    if (error) {
      toastError(error.message);
    } else {
      success('Profile updated successfully!');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to 'avatars' bucket
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        // If bucket is not created, suggest creating it in Supabase
        if (uploadErr.message.includes('bucket') || uploadErr.status === 404) {
          throw new Error('Supabase Storage bucket "avatars" does not exist. Please create a public "avatars" bucket in your Supabase dashboard to enable uploads.');
        }
        throw uploadErr;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Save to profile
      const { error: updateErr } = await updateProfile({ avatar_url: publicUrl });
      if (updateErr) throw updateErr;

      success('Avatar updated successfully!');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Failed to upload avatar image');
    } finally {
      setUploading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const { error } = await resetPassword(user.email);
      if (error) throw error;
      success('Password reset email sent. Please check your inbox.');
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setUpdating(true);
      if (!user) return;

      // Delete user profile row (cascades to plants and logs because of foreign keys)
      const { error: profileDeleteErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileDeleteErr) throw profileDeleteErr;

      // Sign out
      await signOut();
      success('Account deleted successfully. Goodbye!');
      navigate('/login');
    } catch (err) {
      console.error(err);
      toastError(err.message || 'Failed to delete account');
    } finally {
      setUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div style={{ paddingTop: '20px', minHeight: 'calc(100vh - 76px)' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          My Profile
        </span>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
          Settings & Profile
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Avatar Upload block */}
        <div className="pw-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: 0 }}>
          <div style={{ position: 'relative' }}>
            <div
              className="avatar"
              style={{
                width: '100px',
                height: '100px',
                fontSize: '2.5rem',
                border: '4px solid #FFFFFF',
                boxShadow: '0 8px 24px rgba(27,67,50,0.1)'
              }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" />
              ) : (
                profile?.full_name?.charAt(0).toUpperCase() || 'P'
              )}
            </div>
            <label
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '3px solid #FFFFFF',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
              }}
            >
              <Camera size={16} />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{profile?.full_name || 'Plant Lover'}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{user?.email}</p>
          </div>
        </div>

        {/* Edit name form */}
        <div className="pw-card" style={{ margin: 0 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--primary)' }}>Personal Information</h3>
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <User size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Full Name"
                  className="form-input"
                  style={{ paddingLeft: '44px' }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={updating}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={updating}>
              {updating ? 'Saving...' : 'Save Profile Name'}
            </button>
          </form>
        </div>

        {/* Change password, logout, delete */}
        <div className="pw-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>Account Settings</h3>
          
          <button
            onClick={handleResetPassword}
            className="btn btn-outline btn-full"
            style={{ justifyContent: 'flex-start' }}
          >
            <Lock size={18} /> Change Account Password
          </button>

          <button
            onClick={() => signOut()}
            className="btn btn-secondary btn-full"
            style={{ justifyContent: 'flex-start', color: '#1B4332' }}
          >
            <LogOut size={18} /> Sign Out of App
          </button>

          <div style={{ height: '1px', backgroundColor: 'var(--card-border)' }} />

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn btn-danger btn-full"
            style={{ justifyContent: 'flex-start', backgroundColor: '#FFF2F1' }}
          >
            <Trash2 size={18} /> Delete Account Profile
          </button>
        </div>

        {/* App Version Info */}
        <div style={{ textAlign: 'center', marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <p>PlantWatch v1.0.0 (PWA)</p>
          <p style={{ opacity: 0.7, marginTop: '4px' }}>Built on Supabase & Google Maps</p>
        </div>
      </div>

      {/* Delete Confirmation Sheet */}
      {showDeleteConfirm && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()} style={{ borderTop: '5px solid var(--env-danger)' }}>
            <div className="bottom-sheet-handle"></div>
            <div style={{ display: 'flex', gap: '12px', color: 'var(--env-danger)', alignItems: 'center' }}>
              <AlertOctagon size={24} />
              <h3 style={{ fontSize: '1.25rem', color: 'var(--env-danger)' }}>Danger Zone</h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Are you absolutely sure you want to delete your account? This action is <strong>irreversible</strong>.
              All plants, sensor telemetry history, growth metrics, and issue logs will be permanently deleted.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button
                onClick={handleDeleteAccount}
                className="btn btn-danger"
                style={{ flex: 1, backgroundColor: 'var(--env-danger)', color: '#FFF' }}
                disabled={updating}
              >
                Delete Account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={updating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
