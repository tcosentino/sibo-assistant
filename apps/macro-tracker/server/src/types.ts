// Server-side types for MacroMeal

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface MacroTargets extends Macros {
  id: number;
  userId: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  macros: Macros;
}

export interface Recipe {
  id: string;
  userId: number;
  name: string;
  description: string | null;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  macrosPerServing: Macros;
  totalMacros: Macros;
  sourceUrl: string | null;
  sourceType: 'manual' | 'tiktok' | 'instagram' | 'youtube' | null;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MealLogEntry {
  id: number;
  userId: number;
  recipeId: string;
  servings: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  createdAt: string;
}

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}
