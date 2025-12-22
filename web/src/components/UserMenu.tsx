import { useState, useEffect } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import './UserMenu.css';

const PREFERENCES_KEY = 'sibo-assistant-preferences';

interface UserPreferences {
  tolerances: {
    foods: string[];
    fodmapTypes: string[];
    categories: string[];
  };
  sensitivities: {
    foods: string[];
    fodmapTypes: string[];
    categories: string[];
  };
}

const FODMAP_NAMES: Record<string, string> = {
  fructose: 'Fructose',
  lactose: 'Lactose',
  fructans: 'Fructans',
  galactans: 'Galactans',
  'polyols-sorbitol': 'Sorbitol',
  'polyols-mannitol': 'Mannitol',
};

export function UserMenu() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Load preferences from localStorage
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const saved = localStorage.getItem(PREFERENCES_KEY);
        if (saved) {
          setPreferences(JSON.parse(saved));
        }
      } catch {
        // Ignore parse errors
      }
    };

    loadPreferences();
    // Listen for storage changes (when preferences update in ChatWindow)
    window.addEventListener('storage', loadPreferences);
    // Also check periodically for same-tab updates
    const interval = setInterval(loadPreferences, 1000);

    return () => {
      window.removeEventListener('storage', loadPreferences);
      clearInterval(interval);
    };
  }, []);

  const hasPreferences = preferences && (
    preferences.tolerances.foods.length > 0 ||
    preferences.tolerances.fodmapTypes.length > 0 ||
    preferences.tolerances.categories.length > 0 ||
    preferences.sensitivities.foods.length > 0 ||
    preferences.sensitivities.fodmapTypes.length > 0 ||
    preferences.sensitivities.categories.length > 0
  );

  const formatItems = (items: string[], type: 'fodmap' | 'other' = 'other') => {
    return items.map(item => type === 'fodmap' ? (FODMAP_NAMES[item] || item) : item);
  };

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

            <div className="user-menu__memory">
              <div className="user-menu__memory-header">
                <span className="user-menu__memory-icon">🧠</span>
                <span>My Memory</span>
              </div>

              {hasPreferences ? (
                <div className="user-menu__memory-content">
                  {(preferences.tolerances.foods.length > 0 ||
                    preferences.tolerances.fodmapTypes.length > 0 ||
                    preferences.tolerances.categories.length > 0) && (
                    <div className="user-menu__memory-section">
                      <span className="user-menu__memory-label user-menu__memory-label--good">
                        ✓ I tolerate:
                      </span>
                      <span className="user-menu__memory-items">
                        {[
                          ...formatItems(preferences.tolerances.foods),
                          ...formatItems(preferences.tolerances.fodmapTypes, 'fodmap'),
                          ...preferences.tolerances.categories,
                        ].join(', ')}
                      </span>
                    </div>
                  )}

                  {(preferences.sensitivities.foods.length > 0 ||
                    preferences.sensitivities.fodmapTypes.length > 0 ||
                    preferences.sensitivities.categories.length > 0) && (
                    <div className="user-menu__memory-section">
                      <span className="user-menu__memory-label user-menu__memory-label--warning">
                        ⚠ Sensitive to:
                      </span>
                      <span className="user-menu__memory-items">
                        {[
                          ...formatItems(preferences.sensitivities.foods),
                          ...formatItems(preferences.sensitivities.fodmapTypes, 'fodmap'),
                          ...preferences.sensitivities.categories,
                        ].join(', ')}
                      </span>
                    </div>
                  )}

                  {isAuthenticated && (
                    <div className="user-menu__memory-sync">
                      ☁️ Synced across devices
                    </div>
                  )}
                </div>
              ) : (
                <div className="user-menu__memory-empty">
                  No preferences saved yet. Tell the assistant about your tolerances!
                </div>
              )}
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
