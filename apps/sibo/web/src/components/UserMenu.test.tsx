import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './UserMenu';
import { AuthProvider } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

// Mock localStorage
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  }),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock @react-oauth/google
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button
      data-testid="google-login-button"
      onClick={() => onSuccess({ credential: 'mock-credential' })}
    >
      Sign in with Google
    </button>
  ),
}));

// Wrapper component that provides auth context
const TestWrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

// Helper function to render with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

// Helper to set up authenticated state
const setupAuthenticatedUser = () => {
  mockLocalStorage.store['sibo-auth-token'] = 'mock-jwt-token';
  mockLocalStorage.store['sibo-auth-user'] = JSON.stringify({
    id: 1,
    google_id: '123456',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
  });
};

// Helper to set up preferences
const setupPreferences = (prefs: object) => {
  mockLocalStorage.store['sibo-assistant-preferences'] = JSON.stringify(prefs);
};

describe('UserMenu', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.store = {};
    vi.clearAllMocks();
  });

  describe('Unauthenticated State', () => {
    it('should render Google Sign-In button when not authenticated', () => {
      renderWithProviders(<UserMenu />);

      expect(screen.getByTestId('google-login-button')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('should not show user dropdown when not authenticated', () => {
      renderWithProviders(<UserMenu />);

      expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    beforeEach(() => {
      // Mock jwt-decode to return valid payload
      vi.mock('jwt-decode', () => ({
        jwtDecode: () => ({
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          userId: 1,
          googleId: '123456',
          email: 'test@example.com',
        }),
      }));
    });

    it('should render user info when authenticated', async () => {
      setupAuthenticatedUser();
      renderWithProviders(<UserMenu />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });
    });

    it('should show dropdown when clicking user button', async () => {
      setupAuthenticatedUser();
      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      // Click to open dropdown
      await user.click(screen.getByRole('button', { expanded: false }));

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });
    });

    it('should show My Memory section in dropdown', async () => {
      setupAuthenticatedUser();
      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { expanded: false }));

      await waitFor(() => {
        expect(screen.getByText('My Memory')).toBeInTheDocument();
      });
    });

    it('should close dropdown when clicking backdrop', async () => {
      setupAuthenticatedUser();
      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      // Open dropdown
      await user.click(screen.getByRole('button', { expanded: false }));

      await waitFor(() => {
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });

      // Click backdrop to close
      const backdrop = document.querySelector('.user-menu__backdrop');
      if (backdrop) {
        await user.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
      });
    });
  });

  describe('Memory Display', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
    });

    it('should show empty message when no preferences saved', async () => {
      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { expanded: false }));

      await waitFor(() => {
        expect(screen.getByText(/No preferences saved yet/)).toBeInTheDocument();
      });
    });

    it('should display tolerances when saved', async () => {
      setupPreferences({
        tolerances: {
          foods: ['milk'],
          fodmapTypes: ['lactose'],
          categories: [],
        },
        sensitivities: {
          foods: [],
          fodmapTypes: [],
          categories: [],
        },
      });

      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { expanded: false }));

      // Wait for preferences to load (interval check)
      await waitFor(() => {
        expect(screen.getByText(/I tolerate/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should display sensitivities when saved', async () => {
      setupPreferences({
        tolerances: {
          foods: [],
          fodmapTypes: [],
          categories: [],
        },
        sensitivities: {
          foods: ['garlic'],
          fodmapTypes: ['fructans'],
          categories: [],
        },
      });

      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { expanded: false }));

      // Wait for preferences to load (interval check)
      await waitFor(() => {
        expect(screen.getByText(/Sensitive to/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should show sync indicator when authenticated with preferences', async () => {
      setupPreferences({
        tolerances: {
          foods: ['cheese'],
          fodmapTypes: [],
          categories: [],
        },
        sensitivities: {
          foods: [],
          fodmapTypes: [],
          categories: [],
        },
      });

      renderWithProviders(<UserMenu />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { expanded: false }));

      // Wait for preferences to load and check sync indicator
      await waitFor(() => {
        expect(screen.getByText(/Synced across devices/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Context Provider Requirement', () => {
    it('should throw error when rendered without AuthProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<UserMenu />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});
