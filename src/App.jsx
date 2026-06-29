import React, { useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Link,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Import Pages
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Home from './pages/Home';
import PlantsCatalog from './pages/PlantsCatalog';
import AddPlantFlow from './pages/AddPlantFlow';
import PlantDetail from './pages/PlantDetail';
import Profile from './pages/Profile';

// Import Icons
import {
  Home as HomeIcon,
  Search,
  PlusCircle,
  User as UserIcon,
  LogOut,
  Settings,
  X,
} from 'lucide-react';

// Protected Route Guard Wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#F5FBF7',
        fontFamily: '"Outfit", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '3rem' }}>🌱</span>
          <h2 style={{ color: '#1B4332', fontWeight: 600, marginTop: '8px' }}>PlantWatch</h2>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

// App Layout (Header + Bottom Nav + User Menu Dropdown)
function AppLayout({ children }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  // Do not show chrome on auth pages
  const isAuthPage = ['/login', '/signup', '/forgot-password'].includes(
    location.pathname
  );

  const handleSignOut = async () => {
    setShowMenu(false);
    await signOut();
    navigate('/login');
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Global Header */}
      <header className="app-header">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '1.4rem' }}>🌱</span>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--primary)',
            letterSpacing: '-0.3px',
            fontFamily: '"Outfit", sans-serif'
          }}>
            PlantWatch
          </span>
        </Link>

        {/* User Profile Avatar */}
        <div
          className="avatar"
          onClick={() => setShowMenu(true)}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} />
          ) : (
            profile?.full_name?.charAt(0).toUpperCase() || 'P'
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">{children}</main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link
          to="/"
          className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <HomeIcon />
          <span>Home</span>
        </Link>
        <Link
          to="/plants"
          className={`bottom-nav-item ${location.pathname === '/plants' ? 'active' : ''}`}
        >
          <Search />
          <span>My Plants</span>
        </Link>
        <Link
          to="/add-plant"
          className={`bottom-nav-item ${location.pathname === '/add-plant' ? 'active' : ''}`}
        >
          <PlusCircle />
          <span>Add</span>
        </Link>
        <Link
          to="/profile"
          className={`bottom-nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
        >
          <UserIcon />
          <span>Profile</span>
        </Link>
      </nav>

      {/* User Slide-Up Bottom Menu Sheet */}
      {showMenu && (
        <div className="bottom-sheet-backdrop" onClick={() => setShowMenu(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle"></div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="avatar" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" />
                  ) : (
                    profile?.full_name?.charAt(0).toUpperCase() || 'P'
                  )}
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                    {profile?.full_name || 'Plant Lover'}
                  </h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Active gardener
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowMenu(false)}
                className="btn btn-secondary btn-icon-only"
                style={{ width: '36px', height: '36px', minHeight: '36px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '4px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate('/profile');
                }}
                className="btn btn-secondary btn-full"
                style={{ justifyContent: 'flex-start', color: 'var(--primary)' }}
              >
                <UserIcon size={18} /> My Profile
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  navigate('/profile'); // Settings is also handled on the profile view
                }}
                className="btn btn-secondary btn-full"
                style={{ justifyContent: 'flex-start', color: 'var(--primary)' }}
              >
                <Settings size={18} /> Settings
              </button>

              <div style={{ height: '1.5px', backgroundColor: 'var(--card-border)' }} />

              <button
                onClick={handleSignOut}
                className="btn btn-danger btn-full"
                style={{ justifyContent: 'flex-start', backgroundColor: '#FFF2F1' }}
              >
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <AppLayout>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plants"
                element={
                  <ProtectedRoute>
                    <PlantsCatalog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-plant"
                element={
                  <ProtectedRoute>
                    <AddPlantFlow />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plant/:id"
                element={
                  <ProtectedRoute>
                    <PlantDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Catch-All */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
