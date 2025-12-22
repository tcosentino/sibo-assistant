import { useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import './UserMenu.css';

export function UserMenu() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleSuccess = async (response: CredentialResponse) => {
    setLoginError(null);
    if (response.credential) {
      try {
        await login(response.credential);
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : 'Login failed');
      }
    }
  };

  const handleGoogleError = () => {
    setLoginError('Google sign-in failed. Please try again.');
  };

  if (isLoading) {
    return (
      <div className="user-menu user-menu--loading">
        <span className="user-menu__spinner"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="user-menu user-menu--logged-out">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap
          theme="filled_blue"
          size="medium"
          text="signin_with"
          shape="rectangular"
        />
        {loginError && <div className="user-menu__error">{loginError}</div>}
      </div>
    );
  }

  return (
    <div className="user-menu">
      <button
        className="user-menu__trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User'}
            className="user-menu__avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="user-menu__avatar user-menu__avatar--placeholder">
            {user?.name?.[0] || user?.email?.[0] || '?'}
          </div>
        )}
        <span className="user-menu__name">{user?.name || user?.email}</span>
        <span className="user-menu__arrow">▼</span>
      </button>

      {showDropdown && (
        <>
          <div
            className="user-menu__backdrop"
            onClick={() => setShowDropdown(false)}
          />
          <div className="user-menu__dropdown">
            <div className="user-menu__info">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <hr className="user-menu__divider" />
            <button
              className="user-menu__item user-menu__item--logout"
              onClick={() => {
                logout();
                setShowDropdown(false);
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
