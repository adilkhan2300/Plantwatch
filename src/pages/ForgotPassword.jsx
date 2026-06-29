import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Mail, Leaf, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { resetPassword } = useAuth();
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toastError('Please enter your email address');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      toastError(error.message);
    } else {
      success('Reset link sent successfully!');
      setSent(true);
    }
  };

  return (
    <div className="auth-page-container">
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          backgroundColor: 'var(--primary)',
          color: '#FFFFFF',
          marginBottom: '16px',
          boxShadow: '0 8px 24px rgba(27,67,50,0.15)'
        }}>
          <Leaf size={32} />
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
          Reset Password
        </h1>
        <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
          We'll send you a recovery link
        </p>
      </div>

      <div className="pw-card" style={{ padding: '28px 24px' }}>
        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <span style={{ fontSize: '2.5rem' }}>✉️</span>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Check your email</h3>
            <p>
              We have sent a password reset link to <strong>{email}</strong>. Please check your inbox and spam folders.
            </p>
            <button
              onClick={() => setSent(false)}
              className="btn btn-secondary btn-full"
              style={{ marginTop: '8px' }}
            >
              Send again
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="form-input"
                  style={{ paddingLeft: '44px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Sending Link...' : 'Send Reset Link'}
              <Send size={16} />
            </button>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p>
          <Link to="/login" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            color: 'var(--secondary)',
            textDecoration: 'none'
          }}>
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
