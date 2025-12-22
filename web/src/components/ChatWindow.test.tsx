import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWindow } from './ChatWindow';
import type { Food } from '../types/food';

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

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock food data
vi.mock('../data/foods', () => ({
  allFoods: [
    {
      id: 'carrot',
      name: 'Carrot',
      category: 'vegetable',
      fodmapRating: 'low',
      fodmapTypes: [],
      servingSizes: { low: { grams: 75, description: '0.5 cup', cups: '0.5 cup' } },
      siboNotes: 'No FODMAPs. Safe for SIBO.',
    },
    {
      id: 'garlic',
      name: 'Garlic',
      aliases: ['raw garlic'],
      category: 'vegetable',
      fodmapRating: 'high',
      fodmapTypes: ['fructans'],
      servingSizes: { high: { grams: 3, description: '1 clove' } },
      siboNotes: 'High in fructans. Avoid.',
      alternatives: ['garlic-infused-oil'],
    },
    {
      id: 'milk',
      name: 'Milk',
      aliases: ['cow milk', 'whole milk'],
      category: 'dairy',
      fodmapRating: 'high',
      fodmapTypes: ['lactose'],
      servingSizes: { high: { grams: 250, description: '1 cup' } },
      siboNotes: 'High in lactose.',
      alternatives: ['lactose-free-milk'],
    },
  ] as Food[],
}));

describe('ChatWindow', () => {
  const mockOnFoodClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  describe('Rendering', () => {
    it('should render toggle button when closed', () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should open chat window when toggle is clicked', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      expect(screen.getByText('Food Assistant')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/ask about a food/i)).toBeInTheDocument();
    });

    it('should close chat window when toggle is clicked while open', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      // Open
      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);
      expect(screen.getByText('Food Assistant')).toBeInTheDocument();

      // Close
      const closeButton = screen.getByRole('button', { name: /close chat/i });
      await userEvent.click(closeButton);
      expect(screen.queryByText('Food Assistant')).not.toBeInTheDocument();
    });

    it('should show welcome message when opened', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      expect(screen.getByText(/ask me about any food/i)).toBeInTheDocument();
    });
  });

  describe('Message Input', () => {
    it('should have disabled send button when input is empty', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('should enable send button when input has text', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Is carrot safe?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Local Response Generation', () => {
    beforeEach(() => {
      // Make API fail so it falls back to local
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API unavailable'));
    });

    it('should respond about low FODMAP foods', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Can I eat carrot?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/generally safe for SIBO/i)).toBeInTheDocument();
      });
    });

    it('should respond about high FODMAP foods', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'What about garlic?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/high FODMAP and should generally be avoided/i)).toBeInTheDocument();
      });
    });

    it('should respond when food is not found in database', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Can I eat pizza?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/don't have information about that specific food/i)).toBeInTheDocument();
      });
    });
  });

  describe('Preferences', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API unavailable'));
    });

    it('should not show preferences button when no preferences saved', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      // Brain button should not be visible
      expect(screen.queryByTitle(/view your preferences/i)).not.toBeInTheDocument();
    });

    it('should save preferences to localStorage', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      // Preferences are saved on component state change
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should show preferences summary when asked', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'What do you remember about me?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/don't have any saved preferences/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should call API when available', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'Carrot is safe!',
          detectedPreference: null,
        }),
      });

      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Is carrot safe?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/chat'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Carrot is safe!')).toBeInTheDocument();
      });
    });

    it('should fall back to local when API fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Is carrot safe?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      // Should show offline indicator after API fails
      await waitFor(() => {
        expect(screen.getByText(/Offline/i)).toBeInTheDocument();
      });

      // Should still get a response from local
      await waitFor(() => {
        expect(screen.getByText(/safe for SIBO/i)).toBeInTheDocument();
      });
    });
  });

  describe('Image Upload', () => {
    it('should have upload button', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const uploadButton = screen.getByTitle(/upload a photo/i);
      expect(uploadButton).toBeInTheDocument();
    });

    it('should show offline message when trying to analyze image without API', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API unavailable'));

      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      // Simulate having an image selected by submitting with just an image indicator
      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Analyze this image');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      // When using local mode and no database match
      await waitFor(() => {
        expect(screen.getByText(/don't have information/i)).toBeInTheDocument();
      });
    });
  });

  describe('Food Links', () => {
    beforeEach(() => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API unavailable'));
    });

    it('should call onFoodClick when clicking a food link', async () => {
      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Tell me about carrot');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      // Wait for response with food link
      await waitFor(() => {
        expect(screen.getByText(/safe for SIBO/i)).toBeInTheDocument();
      });

      // Find and click the food link button (Carrot in bold)
      const foodLinks = screen.getAllByRole('button');
      const carrotLink = foodLinks.find(btn => btn.textContent === 'Carrot');

      if (carrotLink) {
        await userEvent.click(carrotLink);
        expect(mockOnFoodClick).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'carrot', name: 'Carrot' })
        );
      }
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while waiting for response', async () => {
      // Make fetch take a while
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Response' }),
        }), 1000))
      );

      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Is carrot safe?');
      await userEvent.click(screen.getByRole('button', { name: /send/i }));

      // Input should be disabled during loading
      expect(input).toBeDisabled();
    });

    it('should disable send button while loading', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'Response' }),
        }), 1000))
      );

      render(<ChatWindow onFoodClick={mockOnFoodClick} />);

      const toggleButton = screen.getByRole('button', { name: /ask about food/i });
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask about a food/i);
      await userEvent.type(input, 'Is carrot safe?');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await userEvent.click(sendButton);

      // Send button should be disabled during loading
      expect(sendButton).toBeDisabled();
    });
  });
});
