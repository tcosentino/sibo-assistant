// Tool definitions and handlers for Claude
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { allFoods, type Food, type FodmapRating, type FoodCategory } from './foods-full.js';

// ============================================================================
// TOOL DEFINITIONS - Cached by Anthropic for cost reduction
// ============================================================================

export const TOOLS: Tool[] = [
  {
    name: 'lookup_food',
    description: 'Look up detailed FODMAP information for a specific food by name. Use this when a user asks about a specific food. Returns complete information including FODMAP rating, safe serving sizes, preparation tips, and alternatives.',
    input_schema: {
      type: 'object' as const,
      properties: {
        food_name: {
          type: 'string',
          description: 'The name of the food to look up (e.g., "garlic", "apple", "chicken breast")',
        },
      },
      required: ['food_name'],
    },
  },
  {
    name: 'search_foods',
    description: 'Search for foods by category or FODMAP rating. Use this when users ask for lists of foods (e.g., "what vegetables can I eat?" or "list low FODMAP fruits").',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['vegetable', 'fruit', 'protein', 'grain', 'dairy', 'fat', 'sweetener', 'beverage', 'condiment'],
          description: 'Filter by food category',
        },
        fodmap_rating: {
          type: 'string',
          enum: ['low', 'moderate', 'high'],
          description: 'Filter by FODMAP rating',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'save_preference',
    description: 'Save a user\'s food tolerance or sensitivity to their profile. Use this when a user tells you about foods they can or cannot tolerate (e.g., "I can handle dairy fine" or "onions make me sick"). Always use this tool when you detect a preference statement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['tolerance', 'sensitivity'],
          description: 'Whether this is a food the user tolerates well or is sensitive to',
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of foods or FODMAP types (e.g., ["dairy", "lactose"] or ["garlic", "onions"])',
        },
        reason: {
          type: 'string',
          description: 'Brief note about why (optional, e.g., "user said they can eat cheese without issues")',
        },
      },
      required: ['type', 'items'],
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

interface LookupFoodInput {
  food_name: string;
}

interface SearchFoodsInput {
  category?: FoodCategory;
  fodmap_rating?: FodmapRating;
  limit?: number;
}

interface SavePreferenceInput {
  type: 'tolerance' | 'sensitivity';
  items: string[];
  reason?: string;
}

// Find a food by name or alias (case-insensitive)
function findFood(name: string): Food | undefined {
  const lowerName = name.toLowerCase().trim();
  return allFoods.find(
    (food) =>
      food.name.toLowerCase() === lowerName ||
      food.id === lowerName ||
      food.aliases?.some((alias) => alias.toLowerCase() === lowerName)
  );
}

// Format food for response
function formatFoodResponse(food: Food): string {
  let response = `## ${food.name}\n`;
  response += `**FODMAP Rating:** ${food.fodmapRating.toUpperCase()}\n`;
  response += `**Category:** ${food.category}\n\n`;

  if (food.fodmapTypes.length > 0) {
    response += `**Contains FODMAPs:** ${food.fodmapTypes.join(', ')}\n\n`;
  }

  // Serving sizes
  if (food.servingSizes.low) {
    response += `**Safe Serving:** ${food.servingSizes.low.grams}g`;
    if (food.servingSizes.low.cups) {
      response += ` (${food.servingSizes.low.cups})`;
    }
    response += ` - ${food.servingSizes.low.description}\n\n`;
  }

  response += `**SIBO Notes:** ${food.siboNotes}\n\n`;

  if (food.preparationTips && food.preparationTips.length > 0) {
    response += `**Preparation Tips:**\n`;
    food.preparationTips.forEach((tip) => {
      response += `- ${tip}\n`;
    });
    response += '\n';
  }

  if (food.alternatives && food.alternatives.length > 0) {
    response += `**Alternatives:** ${food.alternatives.join(', ')}\n\n`;
  }

  if (food.pairsWellWith && food.pairsWellWith.length > 0) {
    response += `**Pairs Well With:** ${food.pairsWellWith.join(', ')}\n`;
  }

  return response;
}

// Handle lookup_food tool
export function handleLookupFood(input: LookupFoodInput): string {
  const food = findFood(input.food_name);

  if (!food) {
    // Try fuzzy matching
    const lowerName = input.food_name.toLowerCase();
    const partialMatches = allFoods.filter(
      (f) =>
        f.name.toLowerCase().includes(lowerName) ||
        f.aliases?.some((a) => a.toLowerCase().includes(lowerName))
    );

    if (partialMatches.length > 0) {
      return `I couldn't find an exact match for "${input.food_name}", but here are similar foods:\n\n${partialMatches
        .slice(0, 5)
        .map((f) => `- ${f.name} (${f.fodmapRating} FODMAP)`)
        .join('\n')}\n\nWould you like me to look up any of these?`;
    }

    return `I don't have information about "${input.food_name}" in my database. This could be because:\n- It's known by a different name\n- It's not commonly discussed in FODMAP contexts\n\nCould you try a different name or describe the food?`;
  }

  return formatFoodResponse(food);
}

// Handle search_foods tool
export function handleSearchFoods(input: SearchFoodsInput): string {
  let results = [...allFoods];

  if (input.category) {
    results = results.filter((f) => f.category === input.category);
  }

  if (input.fodmap_rating) {
    results = results.filter((f) => f.fodmapRating === input.fodmap_rating);
  }

  const limit = input.limit || 10;
  results = results.slice(0, limit);

  if (results.length === 0) {
    return `No foods found matching your criteria.`;
  }

  let response = `Found ${results.length} foods`;
  if (input.category) response += ` in ${input.category} category`;
  if (input.fodmap_rating) response += ` with ${input.fodmap_rating} FODMAP rating`;
  response += ':\n\n';

  results.forEach((food) => {
    response += `- **${food.name}** (${food.fodmapRating} FODMAP)`;
    if (food.servingSizes.low) {
      response += ` - Safe: ${food.servingSizes.low.grams}g`;
    }
    response += '\n';
  });

  const totalMatching = allFoods.filter((f) => {
    const matches =
      (!input.category || f.category === input.category) &&
      (!input.fodmap_rating || f.fodmapRating === input.fodmap_rating);
    return matches;
  }).length;

  if (totalMatching > limit) {
    response += `\n_Showing ${limit} of ${totalMatching} matching foods. Ask for more specific criteria or a higher limit._`;
  }

  return response;
}

// Handle save_preference tool - returns the preference to save
export function handleSavePreference(input: SavePreferenceInput): {
  type: 'tolerance' | 'sensitivity';
  items: string[];
  message: string;
} {
  const verb = input.type === 'tolerance' ? 'can tolerate' : 'are sensitive to';
  const items = input.items.map((item) => item.toLowerCase().trim());

  return {
    type: input.type,
    items,
    message: `Got it! I've noted that you ${verb}: ${items.join(', ')}. I'll remember this for future recommendations.`,
  };
}

// Process a tool call and return the result
export function processToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): { result: string; preference?: { type: 'tolerance' | 'sensitivity'; items: string[] } } {
  switch (toolName) {
    case 'lookup_food':
      return { result: handleLookupFood(toolInput as unknown as LookupFoodInput) };

    case 'search_foods':
      return { result: handleSearchFoods(toolInput as unknown as SearchFoodsInput) };

    case 'save_preference': {
      const prefResult = handleSavePreference(toolInput as unknown as SavePreferenceInput);
      return {
        result: prefResult.message,
        preference: { type: prefResult.type, items: prefResult.items },
      };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}

// Get common foods summary for the system prompt (top foods people ask about)
export function getCommonFoodsSummary(): string {
  const commonFoodIds = [
    'garlic', 'onion', 'carrot', 'broccoli', 'spinach', 'potato', 'tomato',
    'apple', 'banana', 'strawberry', 'blueberry', 'orange',
    'chicken-breast', 'beef', 'salmon', 'eggs',
    'rice', 'oats', 'sourdough-bread',
    'milk', 'cheese-cheddar', 'lactose-free-milk',
    'olive-oil', 'butter',
    'honey', 'maple-syrup',
  ];

  const commonFoods = commonFoodIds
    .map((id) => allFoods.find((f) => f.id === id))
    .filter((f): f is Food => f !== undefined);

  let summary = '### Quick Reference - Common Foods\n';

  // Group by rating
  const low = commonFoods.filter((f) => f.fodmapRating === 'low');
  const moderate = commonFoods.filter((f) => f.fodmapRating === 'moderate');
  const high = commonFoods.filter((f) => f.fodmapRating === 'high');

  if (low.length > 0) {
    summary += '\n**LOW FODMAP (Safe):** ';
    summary += low.map((f) => f.name).join(', ');
  }

  if (moderate.length > 0) {
    summary += '\n\n**MODERATE (Portion control):** ';
    summary += moderate.map((f) => f.name).join(', ');
  }

  if (high.length > 0) {
    summary += '\n\n**HIGH FODMAP (Avoid):** ';
    summary += high.map((f) => f.name).join(', ');
  }

  summary += '\n\n_Use the lookup_food tool for detailed information on any food._';

  return summary;
}
