import { describe, it, expect } from 'vitest';
import {
  TOOLS,
  handleLookupFood,
  handleSearchFoods,
  handleSavePreference,
  processToolCall,
  getCommonFoodsSummary,
} from './tools.js';

describe('Tool Definitions', () => {
  it('should export three tools', () => {
    expect(TOOLS).toHaveLength(3);
  });

  it('should have lookup_food tool with correct schema', () => {
    const lookupTool = TOOLS.find(t => t.name === 'lookup_food');
    expect(lookupTool).toBeDefined();
    expect(lookupTool?.input_schema.required).toContain('food_name');
  });

  it('should have search_foods tool with correct schema', () => {
    const searchTool = TOOLS.find(t => t.name === 'search_foods');
    expect(searchTool).toBeDefined();
    expect(searchTool?.input_schema.properties).toHaveProperty('category');
    expect(searchTool?.input_schema.properties).toHaveProperty('fodmap_rating');
    expect(searchTool?.input_schema.properties).toHaveProperty('limit');
  });

  it('should have save_preference tool with correct schema', () => {
    const saveTool = TOOLS.find(t => t.name === 'save_preference');
    expect(saveTool).toBeDefined();
    expect(saveTool?.input_schema.required).toContain('type');
    expect(saveTool?.input_schema.required).toContain('items');
  });
});

describe('handleLookupFood', () => {
  describe('exact name matching', () => {
    it('should find food by exact name (case-insensitive)', () => {
      const result = handleLookupFood({ food_name: 'Garlic' });
      expect(result).toContain('## Garlic');
      expect(result).toContain('FODMAP Rating');
    });

    it('should find food by lowercase name', () => {
      const result = handleLookupFood({ food_name: 'garlic' });
      expect(result).toContain('## Garlic');
    });

    it('should find food by uppercase name', () => {
      const result = handleLookupFood({ food_name: 'GARLIC' });
      expect(result).toContain('## Garlic');
    });
  });

  describe('id matching', () => {
    it('should find food by id', () => {
      const result = handleLookupFood({ food_name: 'chicken-breast' });
      expect(result).toContain('Chicken Breast');
    });
  });

  describe('alias matching', () => {
    it('should find food by alias', () => {
      // Assuming garlic has 'raw garlic' as an alias
      const result = handleLookupFood({ food_name: 'raw garlic' });
      // Should find garlic or related food
      expect(result).toMatch(/Garlic|garlic/i);
    });
  });

  describe('response formatting', () => {
    it('should include FODMAP rating', () => {
      const result = handleLookupFood({ food_name: 'carrot' });
      expect(result).toContain('**FODMAP Rating:**');
    });

    it('should include category', () => {
      const result = handleLookupFood({ food_name: 'carrot' });
      expect(result).toContain('**Category:**');
    });

    it('should include SIBO notes', () => {
      const result = handleLookupFood({ food_name: 'carrot' });
      expect(result).toContain('**SIBO Notes:**');
    });
  });

  describe('fuzzy matching', () => {
    it('should suggest similar foods when partial match found', () => {
      const result = handleLookupFood({ food_name: 'garl' }); // partial match for garlic
      // Should find garlic via partial match
      expect(result).toMatch(/Garlic|similar foods/i);
    });

    it('should return helpful message when no matches found', () => {
      const result = handleLookupFood({ food_name: 'xyznonexistentfood123' });
      expect(result).toContain("don't have information");
    });
  });

  describe('trimming and whitespace', () => {
    it('should handle leading/trailing whitespace', () => {
      const result = handleLookupFood({ food_name: '  garlic  ' });
      expect(result).toContain('## Garlic');
    });
  });
});

describe('handleSearchFoods', () => {
  describe('category filtering', () => {
    it('should filter by vegetable category', () => {
      const result = handleSearchFoods({ category: 'vegetable' });
      expect(result).toContain('vegetable category');
      expect(result).not.toContain('fruit category');
    });

    it('should filter by fruit category', () => {
      const result = handleSearchFoods({ category: 'fruit' });
      expect(result).toContain('fruit category');
    });

    it('should filter by protein category', () => {
      const result = handleSearchFoods({ category: 'protein' });
      expect(result).toContain('protein category');
    });
  });

  describe('FODMAP rating filtering', () => {
    it('should filter by low FODMAP rating', () => {
      const result = handleSearchFoods({ fodmap_rating: 'low' });
      expect(result).toContain('low FODMAP rating');
      // All results should be low FODMAP
      expect(result).not.toMatch(/\(high FODMAP\)/);
      expect(result).not.toMatch(/\(moderate FODMAP\)/);
    });

    it('should filter by high FODMAP rating', () => {
      const result = handleSearchFoods({ fodmap_rating: 'high' });
      expect(result).toContain('high FODMAP rating');
    });

    it('should filter by moderate FODMAP rating', () => {
      const result = handleSearchFoods({ fodmap_rating: 'moderate' });
      expect(result).toContain('moderate FODMAP rating');
    });
  });

  describe('combined filtering', () => {
    it('should filter by both category and rating', () => {
      const result = handleSearchFoods({ category: 'vegetable', fodmap_rating: 'low' });
      expect(result).toContain('vegetable category');
      expect(result).toContain('low FODMAP rating');
    });
  });

  describe('limit parameter', () => {
    it('should respect limit parameter', () => {
      const result = handleSearchFoods({ limit: 3 });
      // Count bullet points (food entries start with "- **")
      const foodEntries = (result.match(/- \*\*/g) || []).length;
      expect(foodEntries).toBeLessThanOrEqual(3);
    });

    it('should default to 10 results', () => {
      const result = handleSearchFoods({});
      const foodEntries = (result.match(/- \*\*/g) || []).length;
      expect(foodEntries).toBeLessThanOrEqual(10);
    });

    it('should show message when more results available', () => {
      const result = handleSearchFoods({ limit: 2 });
      expect(result).toContain('Showing 2 of');
    });
  });

  describe('result count', () => {
    it('should show total count when more results available', () => {
      const result = handleSearchFoods({ category: 'vegetable', fodmap_rating: 'low', limit: 5 });
      // Should show that there are more results available
      expect(result).toContain('Showing 5 of');
    });
  });
});

describe('handleSavePreference', () => {
  describe('tolerance type', () => {
    it('should save tolerance preference', () => {
      const result = handleSavePreference({
        type: 'tolerance',
        items: ['dairy', 'lactose'],
      });

      expect(result.type).toBe('tolerance');
      expect(result.items).toEqual(['dairy', 'lactose']);
      expect(result.message).toContain('can tolerate');
      expect(result.message).toContain('dairy');
      expect(result.message).toContain('lactose');
    });
  });

  describe('sensitivity type', () => {
    it('should save sensitivity preference', () => {
      const result = handleSavePreference({
        type: 'sensitivity',
        items: ['garlic', 'onions'],
      });

      expect(result.type).toBe('sensitivity');
      expect(result.items).toEqual(['garlic', 'onions']);
      expect(result.message).toContain('are sensitive to');
      expect(result.message).toContain('garlic');
      expect(result.message).toContain('onions');
    });
  });

  describe('item normalization', () => {
    it('should lowercase items', () => {
      const result = handleSavePreference({
        type: 'tolerance',
        items: ['DAIRY', 'Lactose'],
      });

      expect(result.items).toEqual(['dairy', 'lactose']);
    });

    it('should trim whitespace from items', () => {
      const result = handleSavePreference({
        type: 'tolerance',
        items: ['  dairy  ', ' lactose '],
      });

      expect(result.items).toEqual(['dairy', 'lactose']);
    });
  });

  describe('single item', () => {
    it('should handle single item array', () => {
      const result = handleSavePreference({
        type: 'sensitivity',
        items: ['fructans'],
      });

      expect(result.items).toHaveLength(1);
      expect(result.message).toContain('fructans');
    });
  });

  describe('optional reason', () => {
    it('should accept optional reason parameter', () => {
      // The reason is accepted but not currently used in the message
      const result = handleSavePreference({
        type: 'tolerance',
        items: ['cheese'],
        reason: 'user said they eat cheese daily',
      });

      expect(result.type).toBe('tolerance');
      expect(result.items).toEqual(['cheese']);
    });
  });
});

describe('processToolCall', () => {
  describe('routing', () => {
    it('should route lookup_food to correct handler', () => {
      const result = processToolCall('lookup_food', { food_name: 'carrot' });
      expect(result.result).toContain('Carrot');
      expect(result.preference).toBeUndefined();
    });

    it('should route search_foods to correct handler', () => {
      const result = processToolCall('search_foods', { category: 'vegetable', limit: 5 });
      expect(result.result).toContain('vegetable');
      expect(result.preference).toBeUndefined();
    });

    it('should route save_preference to correct handler', () => {
      const result = processToolCall('save_preference', {
        type: 'tolerance',
        items: ['dairy'],
      });
      expect(result.result).toContain('can tolerate');
      expect(result.preference).toBeDefined();
      expect(result.preference?.type).toBe('tolerance');
      expect(result.preference?.items).toEqual(['dairy']);
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', () => {
      const result = processToolCall('unknown_tool', {});
      expect(result.result).toContain('Unknown tool');
      expect(result.result).toContain('unknown_tool');
    });
  });

  describe('preference extraction', () => {
    it('should extract preference from save_preference calls', () => {
      const result = processToolCall('save_preference', {
        type: 'sensitivity',
        items: ['garlic', 'onions'],
      });

      expect(result.preference).toEqual({
        type: 'sensitivity',
        items: ['garlic', 'onions'],
      });
    });

    it('should not include preference for other tools', () => {
      const lookupResult = processToolCall('lookup_food', { food_name: 'carrot' });
      expect(lookupResult.preference).toBeUndefined();

      const searchResult = processToolCall('search_foods', { limit: 5 });
      expect(searchResult.preference).toBeUndefined();
    });
  });
});

describe('getCommonFoodsSummary', () => {
  it('should return a summary string', () => {
    const summary = getCommonFoodsSummary();
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
  });

  it('should include Quick Reference header', () => {
    const summary = getCommonFoodsSummary();
    expect(summary).toContain('Quick Reference');
  });

  it('should group foods by FODMAP rating', () => {
    const summary = getCommonFoodsSummary();
    expect(summary).toContain('LOW FODMAP');
    expect(summary).toContain('HIGH FODMAP');
  });

  it('should include common foods like garlic and carrot', () => {
    const summary = getCommonFoodsSummary();
    // These are in the commonFoodIds list
    expect(summary).toMatch(/Garlic|Carrot/);
  });

  it('should include instruction to use lookup tool', () => {
    const summary = getCommonFoodsSummary();
    expect(summary).toContain('lookup_food tool');
  });
});
