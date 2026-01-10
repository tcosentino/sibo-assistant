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

export interface ServingSize {
  grams: number;
  description: string;
  cups?: string;
}

export interface Food {
  id: string;
  name: string;
  aliases?: string[];
  category: FoodCategory;
  subcategory?: string;
  fodmapRating: FodmapRating;
  fodmapTypes: FodmapType[];
  servingSizes: {
    low?: ServingSize;
    moderate?: ServingSize;
    high?: ServingSize;
  };
  siboNotes: string;
  preparationTips?: string[];
  alternatives?: string[];
  pairsWellWith?: string[];
  nutritionalHighlights?: string[];
  source?: string;
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
