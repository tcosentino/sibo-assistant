import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoodDetail } from './FoodDetail';
import type { Food } from '../types/food';

// Sample food data for tests
const lowFodmapFood: Food = {
  id: 'carrot',
  name: 'Carrot',
  aliases: ['carrots'],
  category: 'vegetable',
  fodmapRating: 'low',
  fodmapTypes: [],
  servingSizes: {
    low: { grams: 75, description: 'Half a medium carrot', cups: '0.5 cup' },
  },
  siboNotes: 'No FODMAPs detected. Safe for SIBO patients.',
  preparationTips: ['Cook to reduce fiber load', 'Avoid raw in large amounts'],
  nutritionalHighlights: ['High in beta-carotene', 'Good source of fiber'],
  source: 'Monash University',
};

const highFodmapFood: Food = {
  id: 'garlic',
  name: 'Garlic',
  aliases: ['raw garlic', 'garlic cloves'],
  category: 'vegetable',
  fodmapRating: 'high',
  fodmapTypes: ['fructans'],
  servingSizes: {
    high: { grams: 3, description: '1 clove' },
  },
  siboNotes: 'High in fructans. Avoid during elimination phase.',
  alternatives: ['garlic-infused-oil', 'chives'],
  pairsWellWith: ['Garlic-infused oil for flavor'],
  source: 'Monash University',
};

const moderateFodmapFood: Food = {
  id: 'avocado',
  name: 'Avocado',
  category: 'fruit',
  fodmapRating: 'moderate',
  fodmapTypes: ['polyols-sorbitol'],
  servingSizes: {
    low: { grams: 30, description: '1/8 avocado', cups: '2 tbsp' },
    moderate: { grams: 45, description: '1/4 avocado' },
    high: { grams: 80, description: '1/2 avocado' },
  },
  siboNotes: 'Contains sorbitol. Small portions are safe.',
};

describe('FoodDetail', () => {
  const mockOnClose = vi.fn();
  const mockOnFoodClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render food name and badge', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByRole('heading', { name: 'Carrot' })).toBeInTheDocument();
      expect(screen.getByText('✓ Low FODMAP')).toBeInTheDocument();
    });

    it('should render low FODMAP badge for low rating foods', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText('✓ Low FODMAP')).toBeInTheDocument();
    });

    it('should render moderate FODMAP badge for moderate rating foods', () => {
      render(<FoodDetail food={moderateFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText('⚠ Moderate FODMAP')).toBeInTheDocument();
    });

    it('should render high FODMAP badge for high rating foods', () => {
      render(<FoodDetail food={highFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText('✗ High FODMAP')).toBeInTheDocument();
    });

    it('should render aliases when present', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText(/Also known as: carrots/)).toBeInTheDocument();
    });

    it('should not render aliases section when not present', () => {
      render(<FoodDetail food={moderateFodmapFood} onClose={mockOnClose} />);
      expect(screen.queryByText(/Also known as/)).not.toBeInTheDocument();
    });

    it('should render SIBO notes', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText('No FODMAPs detected. Safe for SIBO patients.')).toBeInTheDocument();
    });

    it('should render source when present', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText(/Source: Monash University/)).toBeInTheDocument();
    });
  });

  describe('Serving Sizes', () => {
    it('should render safe serving for low FODMAP foods', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Serving Sizes')).toBeInTheDocument();
      expect(screen.getByText('Safe Serving')).toBeInTheDocument();
      // Text is split across elements, use regex
      expect(screen.getByText(/75/)).toBeInTheDocument();
      expect(screen.getByText(/0\.5 cup/)).toBeInTheDocument();
    });

    it('should render all serving sizes for moderate foods', () => {
      render(<FoodDetail food={moderateFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Safe Serving')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Avoid')).toBeInTheDocument();
    });

    it('should render high serving size with plus sign', () => {
      render(<FoodDetail food={highFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByText('3g+')).toBeInTheDocument();
    });
  });

  describe('FODMAP Types', () => {
    it('should render FODMAP types when present', () => {
      render(<FoodDetail food={highFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Contains These FODMAPs')).toBeInTheDocument();
      expect(screen.getByText('Fructans')).toBeInTheDocument();
    });

    it('should not render FODMAP types section when empty', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.queryByText('Contains These FODMAPs')).not.toBeInTheDocument();
    });
  });

  describe('Preparation Tips', () => {
    it('should render preparation tips when present', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Preparation Tips')).toBeInTheDocument();
      expect(screen.getByText('Cook to reduce fiber load')).toBeInTheDocument();
      expect(screen.getByText('Avoid raw in large amounts')).toBeInTheDocument();
    });

    it('should not render tips section when not present', () => {
      render(<FoodDetail food={moderateFodmapFood} onClose={mockOnClose} />);
      expect(screen.queryByText('Preparation Tips')).not.toBeInTheDocument();
    });
  });

  describe('Alternatives', () => {
    it('should render alternatives when present', () => {
      render(<FoodDetail food={highFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Safer Alternatives')).toBeInTheDocument();
      expect(screen.getByText('Garlic Infused Oil')).toBeInTheDocument();
      expect(screen.getByText('Chives')).toBeInTheDocument();
    });

    it('should not render alternatives section when not present', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.queryByText('Safer Alternatives')).not.toBeInTheDocument();
    });

    it('should render alternatives as clickable links when allFoods provided', () => {
      const allFoods = [
        highFodmapFood,
        { ...lowFodmapFood, id: 'garlic-infused-oil', name: 'Garlic Infused Oil' },
      ];

      render(
        <FoodDetail
          food={highFodmapFood}
          onClose={mockOnClose}
          allFoods={allFoods}
          onFoodClick={mockOnFoodClick}
        />
      );

      const linkButton = screen.getByRole('button', { name: 'Garlic Infused Oil' });
      expect(linkButton).toBeInTheDocument();
    });

    it('should call onFoodClick when clicking alternative link', async () => {
      const user = userEvent.setup();
      const linkedFood = { ...lowFodmapFood, id: 'garlic-infused-oil', name: 'Garlic Infused Oil' };
      const allFoods = [highFodmapFood, linkedFood];

      render(
        <FoodDetail
          food={highFodmapFood}
          onClose={mockOnClose}
          allFoods={allFoods}
          onFoodClick={mockOnFoodClick}
        />
      );

      const linkButton = screen.getByRole('button', { name: 'Garlic Infused Oil' });
      await user.click(linkButton);

      expect(mockOnFoodClick).toHaveBeenCalledWith(linkedFood);
    });
  });

  describe('Close Button', () => {
    it('should render close button', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: '×' });
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: '×' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking overlay backdrop', async () => {
      const user = userEvent.setup();
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      // Click the overlay (parent container)
      const overlay = document.querySelector('.food-detail-overlay');
      if (overlay) {
        await user.click(overlay);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not close when clicking modal content', async () => {
      const user = userEvent.setup();
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      // Click the modal content area
      const modalContent = document.querySelector('.food-detail');
      if (modalContent) {
        await user.click(modalContent);
        expect(mockOnClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Accessibility', () => {
    it('should have heading for food name', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);
      expect(screen.getByRole('heading', { level: 2, name: 'Carrot' })).toBeInTheDocument();
    });

    it('should have section headings', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByRole('heading', { level: 3, name: 'Serving Sizes' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'SIBO Notes' })).toBeInTheDocument();
    });

    it('should have accessible close button', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: '×' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toBeEnabled();
    });
  });

  describe('Nutritional Highlights', () => {
    it('should render nutritional highlights when present', () => {
      render(<FoodDetail food={lowFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Nutritional Highlights')).toBeInTheDocument();
      expect(screen.getByText('High in beta-carotene')).toBeInTheDocument();
      expect(screen.getByText('Good source of fiber')).toBeInTheDocument();
    });
  });

  describe('Pairs Well With', () => {
    it('should render pairings when present', () => {
      render(<FoodDetail food={highFodmapFood} onClose={mockOnClose} />);

      expect(screen.getByText('Pairs Well With')).toBeInTheDocument();
      expect(screen.getByText('Garlic-infused oil for flavor')).toBeInTheDocument();
    });
  });
});

/**
 * Note: React Testing Library tests DOM structure and interactions,
 * not CSS rendering. For visual mobile testing (viewport sizes, overflow,
 * z-index layering), use:
 * - Playwright with screenshot comparisons
 * - Storybook with Chromatic for visual regression
 * - Cypress component testing
 *
 * Mobile-specific visual concerns to test with E2E tools:
 * 1. FoodDetail modal renders from bottom on mobile (align-items: flex-end)
 * 2. Close button stays visible and clickable at all viewport sizes
 * 3. Content scrolls properly within max-height: 90vh
 * 4. z-index layering when chat window is also open (z-index 100 vs 1002)
 */
