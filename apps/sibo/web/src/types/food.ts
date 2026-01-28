export type FodmapRating = 'low' | 'moderate' | 'high';

export type FodmapType =
  | 'fructose'
  | 'lactose'
  | 'fructans'
  | 'galactans'
  | 'polyols-sorbitol'
  | 'polyols-mannitol';

export type FoodCategory =
  | 'vegetable'
  | 'fruit'
  | 'protein'
  | 'grain'
  | 'dairy'
  | 'fat'
  | 'sweetener'
  | 'beverage'
  | 'condiment';

// Nutrition data structures (general-purpose)
export interface NutrientsPer100g {
  calories?: number;      // kcal
  protein?: number;       // grams
  carbs?: number;         // grams
  fiber?: number;         // grams
  sugar?: number;         // grams
  fat?: number;           // grams
  saturatedFat?: number;  // grams
  sodium?: number;        // milligrams
  potassium?: number;     // milligrams
  vitaminC?: number;      // milligrams
  vitaminK?: number;      // micrograms
  vitaminA?: number;      // micrograms RAE
  calcium?: number;       // milligrams
  iron?: number;          // milligrams
}

export interface NutritionServingSize {
  amount: number;         // grams
  unit: string;           // typically 'g'
  description: string;    // e.g., '1 cup chopped' or '1 tsp ground'
}

export interface Nutrition {
  per100g: NutrientsPer100g;
  servingSize?: NutritionServingSize;
  source?: string;        // e.g., 'USDA FoodData Central'
  fdcId?: string;         // USDA FoodData Central ID
}

// FODMAP serving size (SIBO-specific)
export interface FodmapServingSize {
  grams: number;
  description: string;
  cups?: string;
}

export interface Food {
  // Required fields (general)
  id: string;
  name: string;
  category: FoodCategory;

  // Optional fields (general)
  aliases?: string[];
  subcategory?: string;
  nutrition?: Nutrition;

  // SIBO-specific fields (optional for general use)
  fodmapRating?: FodmapRating;
  fodmapTypes?: FodmapType[];
  servingSizes?: {
    low?: FodmapServingSize;
    moderate?: FodmapServingSize;
    high?: FodmapServingSize;
  };
  siboNotes?: string;
  preparationTips?: string[];
  alternatives?: string[];
  pairsWellWith?: string[];
  nutritionalHighlights?: string[];  // Legacy field, prefer nutrition.per100g
  source?: string;                   // FODMAP data source
  lastUpdated?: string;
}

export interface FoodDatabase {
  vegetables: Food[];
  fruits: Food[];
  proteins: Food[];
  grains: Food[];
  dairy: Food[];
  fats: Food[];
  sweeteners: Food[];
  beverages: Food[];
  condiments: Food[];
}
