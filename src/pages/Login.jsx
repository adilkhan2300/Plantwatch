import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Mail, Lock, Eye, EyeOff, Leaf, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signInWithGoogle } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toastError('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toastError(error.message);
    } else {
      success('Welcome back!');
      navigate('/');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      toastError(error.message);
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
          PlantWatch <span style={{ fontWeight: 400 }}>🌱</span>
        </h1>
        <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
          Your smart garden companion
        </p>
      </div>

      <div className="pw-card" style={{ padding: '28px 24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary)', textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="form-input"
                style={{ paddingLeft: '44px', paddingRight: '44px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div style={{ flex: 1, height: '1.5px', backgroundColor: 'var(--card-border)' }}></div>
          <span style={{ padding: '0 16px', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: '1.5px', backgroundColor: 'var(--card-border)' }}></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="btn btn-outline btn-full"
          disabled={loading}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '4px' }}>
            <path fill="#EA4335" d="M12 5.04c1.7 0 3.23.59 4.43 1.73l3.3-3.3C17.74 1.58 15.06 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 3C6.18 7.56 8.84 5.04 12 5.04z"/>
            <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.11 2.73-2.36 3.58l3.66 2.84c2.14-1.98 3.39-4.88 3.39-8.57z"/>
            <path fill="#FBBC05" d="M5.24 14.44a6.97 6.97 0 0 1 0-4.88l-3.85-3A11.97 11.97 0 0 0 1 12c0 1.94.46 3.77 1.28 5.4l3.96-2.96z"/>
            <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.08-4.3 1.08-3.16 0-5.82-2.52-6.76-5.52l-3.96 2.96C3.37 20.33 7.35 23 12 23z"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <p>
          Don't have an account?{' '}
          <Link to="/signup" style={{ fontWeight: 700, color: 'var(--secondary)', textDecoration: 'none' }}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
