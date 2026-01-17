#!/usr/bin/env node

/**
 * Script to generate TypeScript data file from JSON food database
 * Run with: node scripts/generate-food-data.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'foods');
const WEB_OUTPUT_FILE = path.join(__dirname, '..', 'web', 'src', 'data', 'foods.ts');
const SERVER_OUTPUT_FILE = path.join(__dirname, '..', 'server', 'src', 'foods-full.ts');

function loadFoodsFromDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  const foods = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      const food = JSON.parse(content);
      foods.push(food);
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
    }
  }

  return foods;
}

function main() {
  const categories = ['vegetables', 'fruits', 'proteins', 'grains', 'dairy', 'fats', 'sweeteners', 'beverages', 'condiments'];

  const data = {};

  for (const category of categories) {
    const dirPath = path.join(DATA_DIR, category);
    data[category] = loadFoodsFromDirectory(dirPath);
    console.log(`Loaded ${data[category].length} items from ${category}`);
  }

  // Generate web TypeScript file
  const webOutput = `// Auto-generated file - do not edit directly
// Run: node scripts/generate-food-data.js

import type { Food } from '../types/food';

export const vegetables: Food[] = ${JSON.stringify(data.vegetables, null, 2)};

export const fruits: Food[] = ${JSON.stringify(data.fruits || [], null, 2)};

export const proteins: Food[] = ${JSON.stringify(data.proteins || [], null, 2)};

export const grains: Food[] = ${JSON.stringify(data.grains || [], null, 2)};

export const dairy: Food[] = ${JSON.stringify(data.dairy || [], null, 2)};

export const fats: Food[] = ${JSON.stringify(data.fats || [], null, 2)};

export const sweeteners: Food[] = ${JSON.stringify(data.sweeteners || [], null, 2)};

export const beverages: Food[] = ${JSON.stringify(data.beverages || [], null, 2)};

export const condiments: Food[] = ${JSON.stringify(data.condiments || [], null, 2)};

export const allFoods: Food[] = [
  ...vegetables,
  ...fruits,
  ...proteins,
  ...grains,
  ...dairy,
  ...fats,
  ...sweeteners,
  ...beverages,
  ...condiments,
];

export const foodsByCategory = {
  vegetables,
  fruits,
  proteins,
  grains,
  dairy,
  fats,
  sweeteners,
  beverages,
  condiments,
};
`;

  // Generate server TypeScript file (with inline types for standalone use)
  const serverOutput = `// Auto-generated file - do not edit directly
// Run: node scripts/generate-food-data.js

// Type definitions (copied from web/src/types/food.ts for server compatibility)
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

export const vegetables: Food[] = ${JSON.stringify(data.vegetables, null, 2)};

export const fruits: Food[] = ${JSON.stringify(data.fruits || [], null, 2)};

export const proteins: Food[] = ${JSON.stringify(data.proteins || [], null, 2)};

export const grains: Food[] = ${JSON.stringify(data.grains || [], null, 2)};

export const dairy: Food[] = ${JSON.stringify(data.dairy || [], null, 2)};

export const fats: Food[] = ${JSON.stringify(data.fats || [], null, 2)};

export const sweeteners: Food[] = ${JSON.stringify(data.sweeteners || [], null, 2)};

export const beverages: Food[] = ${JSON.stringify(data.beverages || [], null, 2)};

export const condiments: Food[] = ${JSON.stringify(data.condiments || [], null, 2)};

export const allFoods: Food[] = [
  ...vegetables,
  ...fruits,
  ...proteins,
  ...grains,
  ...dairy,
  ...fats,
  ...sweeteners,
  ...beverages,
  ...condiments,
];

export const foodsByCategory = {
  vegetables,
  fruits,
  proteins,
  grains,
  dairy,
  fats,
  sweeteners,
  beverages,
  condiments,
};
`;

  fs.writeFileSync(WEB_OUTPUT_FILE, webOutput);
  console.log(`\nGenerated ${WEB_OUTPUT_FILE}`);

  fs.writeFileSync(SERVER_OUTPUT_FILE, serverOutput);
  console.log(`Generated ${SERVER_OUTPUT_FILE}`);

  console.log(`Total foods: ${Object.values(data).flat().length}`);
}

main();
