// MacroMeal Recipe Types

export interface Macros {
  protein: number;  // grams
  carbs: number;    // grams
  fat: number;      // grams
  calories: number; // kcal
}

export interface MacroTargets extends Macros {
  id: number;
  name: string; // e.g., "Bulk", "Cut", "Maintenance"
  isActive: boolean;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  macros: Macros;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  macrosPerServing: Macros;
  totalMacros: Macros;
  sourceUrl?: string;
  sourceType?: 'manual' | 'tiktok' | 'instagram' | 'youtube';
  imageUrl?: string;
  prepTime?: number;   // minutes
  cookTime?: number;   // minutes
  createdAt: string;
  updatedAt: string;
}

export interface MealLogEntry {
  id: number;
  recipeId: string;
  recipeName: string;
  servings: number;
  macros: Macros;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  loggedAt: string;
}

export interface DailyLog {
  date: string;
  entries: MealLogEntry[];
  totalMacros: Macros;
  remaining: Macros;
}

// Tag categories for organization
export type TagCategory =
  | 'meal-type'    // breakfast, lunch, dinner, snack
  | 'cuisine'      // mexican, italian, asian, etc.
  | 'prep-style'   // quick, meal-prep, slow-cooker
  | 'protein'      // chicken, beef, fish, vegetarian
  | 'custom';      // user-defined tags

export interface Tag {
  name: string;
  category: TagCategory;
}

// Search/filter types
export interface RecipeFilter {
  tags?: string[];
  minProtein?: number;
  maxCalories?: number;
  mealType?: string;
  searchQuery?: string;
}
