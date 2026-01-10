// Tool definitions for MacroMeal AI assistant
import { defineTool, type ToolDefinition } from '@monorepo/agent';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const searchRecipesTool = defineTool<{
  query?: string;
  tags?: string[];
  minProtein?: number;
  maxCalories?: number;
}>(
  'search_recipes',
  'Search the user\'s recipe library. Use this when users ask for recipe suggestions or want to find recipes matching certain criteria.',
  {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g., "quick chicken dinner")',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (e.g., ["mexican", "dinner"])',
      },
      minProtein: {
        type: 'number',
        description: 'Minimum protein per serving in grams',
      },
      maxCalories: {
        type: 'number',
        description: 'Maximum calories per serving',
      },
    },
    required: [],
  },
  async (input) => {
    // TODO: Implement actual search logic
    return {
      result: `Searching recipes with: ${JSON.stringify(input)}`,
      metadata: { searchParams: input },
    };
  }
);

export const calculatePortionTool = defineTool<{
  recipeId: string;
  targetMacro: 'protein' | 'carbs' | 'fat' | 'calories';
  targetAmount: number;
}>(
  'calculate_portion',
  'Calculate how many servings of a recipe are needed to hit a specific macro target. Use this when users want to know portion sizes.',
  {
    type: 'object' as const,
    properties: {
      recipeId: {
        type: 'string',
        description: 'The ID of the recipe to calculate portions for',
      },
      targetMacro: {
        type: 'string',
        enum: ['protein', 'carbs', 'fat', 'calories'],
        description: 'Which macro to optimize for',
      },
      targetAmount: {
        type: 'number',
        description: 'The target amount of the macro',
      },
    },
    required: ['recipeId', 'targetMacro', 'targetAmount'],
  },
  async (input) => {
    // TODO: Implement portion calculation
    return {
      result: `Calculating ${input.targetAmount}g ${input.targetMacro} for recipe ${input.recipeId}`,
    };
  }
);

export const suggestDinnerTool = defineTool<{
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  remainingCalories: number;
  preferences?: string[];
}>(
  'suggest_dinner',
  'Suggest dinner recipes from the user\'s library that would help them hit their remaining macro targets for the day.',
  {
    type: 'object' as const,
    properties: {
      remainingProtein: {
        type: 'number',
        description: 'Remaining protein needed for the day (grams)',
      },
      remainingCarbs: {
        type: 'number',
        description: 'Remaining carbs needed for the day (grams)',
      },
      remainingFat: {
        type: 'number',
        description: 'Remaining fat needed for the day (grams)',
      },
      remainingCalories: {
        type: 'number',
        description: 'Remaining calories needed for the day',
      },
      preferences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional preferences (e.g., ["quick", "chicken"])',
      },
    },
    required: ['remainingProtein', 'remainingCarbs', 'remainingFat', 'remainingCalories'],
  },
  async (input) => {
    // TODO: Implement dinner suggestion logic
    return {
      result: `Suggesting dinners to hit: ${input.remainingProtein}g protein, ${input.remainingCalories} cal`,
    };
  }
);

export const extractRecipeTool = defineTool<{
  url: string;
}>(
  'extract_recipe',
  'Extract a recipe from a social media URL (TikTok, Instagram Reel, YouTube). Use this when users paste a video link.',
  {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the social media post/video',
      },
    },
    required: ['url'],
  },
  async (input) => {
    // TODO: Implement recipe extraction with video analysis
    return {
      result: `Extracting recipe from: ${input.url}`,
    };
  }
);

export const getDailyProgressTool = defineTool<{
  date?: string;
}>(
  'get_daily_progress',
  'Get the user\'s macro progress for a specific day. Returns what they\'ve logged and what remains.',
  {
    type: 'object' as const,
    properties: {
      date: {
        type: 'string',
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
    required: [],
  },
  async (input) => {
    // TODO: Implement daily progress lookup
    const date = input.date || new Date().toISOString().split('T')[0];
    return {
      result: `Getting progress for ${date}`,
    };
  }
);

// Export all tools
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MACRO_TRACKER_TOOLS: ToolDefinition<any>[] = [
  searchRecipesTool,
  calculatePortionTool,
  suggestDinnerTool,
  extractRecipeTool,
  getDailyProgressTool,
];
