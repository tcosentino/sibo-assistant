#!/usr/bin/env node

/**
 * Script to enrich food data with USDA FoodData Central nutrition information
 * Run with: node scripts/enrich-with-usda.js [--dry-run] [--category=vegetables] [--food=broccoli]
 *
 * USDA FoodData Central API: https://fdc.nal.usda.gov/api-guide/
 * Rate limit: 1000 requests/hour per IP
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'foods');
const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA API key - use DEMO_KEY for testing or set USDA_API_KEY env var
// Get your own key at: https://fdc.nal.usda.gov/api-key-signup.html
const API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

// USDA nutrient IDs mapped to our schema fields
const NUTRIENT_MAP = {
  1008: 'calories',      // Energy (kcal)
  1003: 'protein',       // Protein
  1005: 'carbs',         // Carbohydrate, by difference
  1079: 'fiber',         // Fiber, total dietary
  2000: 'sugar',         // Sugars, total
  1004: 'fat',           // Total lipid (fat)
  1258: 'saturatedFat',  // Fatty acids, total saturated
  1093: 'sodium',        // Sodium, Na
  1092: 'potassium',     // Potassium, K
  1162: 'vitaminC',      // Vitamin C, total ascorbic acid
  1185: 'vitaminK',      // Vitamin K (phylloquinone)
  1106: 'vitaminA',      // Vitamin A, RAE
  1087: 'calcium',       // Calcium, Ca
  1089: 'iron',          // Iron, Fe
};

// Default serving sizes by category (in grams)
const DEFAULT_SERVINGS = {
  vegetable: { amount: 100, unit: 'g', description: '1 cup raw' },
  fruit: { amount: 150, unit: 'g', description: '1 medium piece' },
  protein: { amount: 85, unit: 'g', description: '3 oz cooked' },
  grain: { amount: 45, unit: 'g', description: '1 slice or 1/2 cup cooked' },
  dairy: { amount: 245, unit: 'g', description: '1 cup' },
  fat: { amount: 14, unit: 'g', description: '1 tbsp' },
  sweetener: { amount: 4, unit: 'g', description: '1 tsp' },
  beverage: { amount: 240, unit: 'g', description: '1 cup (8 fl oz)' },
  condiment: { amount: 15, unit: 'g', description: '1 tbsp' },
};

// Food name overrides for better USDA matching
const SEARCH_OVERRIDES = {
  'bok-choy': 'bok choy raw',
  'bell-pepper': 'bell pepper raw',
  'green-beans': 'green beans raw',
  'swiss-chard': 'swiss chard raw',
  'butternut-squash': 'butternut squash raw',
  'spaghetti-squash': 'spaghetti squash raw',
  'acorn-squash': 'acorn squash raw',
  'kabocha-squash': 'kabocha squash raw',
  'delicata-squash': 'delicata squash raw',
  'maple-syrup': 'maple syrup',
  'olive-oil': 'olive oil',
  'coconut-oil': 'coconut oil',
  'almond-butter': 'almond butter',
  'peanut-butter': 'peanut butter',
};

// Parse command line arguments
function parseArgs() {
  const args = {
    dryRun: false,
    category: null,
    food: null,
    verbose: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--verbose' || arg === '-v') args.verbose = true;
    else if (arg.startsWith('--category=')) args.category = arg.split('=')[1];
    else if (arg.startsWith('--food=')) args.food = arg.split('=')[1];
  }

  return args;
}

// Sleep helper for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Search USDA for a food item
async function searchUSDA(query) {
  const url = `${USDA_API_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=Foundation,SR Legacy&pageSize=5`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`USDA API error: ${response.status} ${response.statusText} - ${text}`);
  }

  const data = await response.json();
  return data.foods || [];
}

// Get detailed food info by FDC ID
async function getFoodDetails(fdcId) {
  const url = `${USDA_API_BASE}/food/${fdcId}?api_key=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`USDA API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

// Extract nutrition data from USDA food details
function extractNutrition(usdaFood, category) {
  const per100g = {};

  // Get nutrients from the food data
  const nutrients = usdaFood.foodNutrients || [];

  for (const nutrient of nutrients) {
    const nutrientId = nutrient.nutrient?.id || nutrient.nutrientId;
    const fieldName = NUTRIENT_MAP[nutrientId];

    if (fieldName) {
      const value = nutrient.amount ?? nutrient.value;
      if (value !== undefined && value !== null) {
        // Round to 2 decimal places
        per100g[fieldName] = Math.round(value * 100) / 100;
      }
    }
  }

  // Get serving size (use portion data if available, otherwise default)
  let servingSize = DEFAULT_SERVINGS[category] || DEFAULT_SERVINGS.vegetable;

  if (usdaFood.foodPortions && usdaFood.foodPortions.length > 0) {
    const portion = usdaFood.foodPortions[0];
    if (portion.gramWeight) {
      servingSize = {
        amount: portion.gramWeight,
        unit: 'g',
        description: portion.portionDescription || portion.modifier || `${portion.gramWeight}g`,
      };
    }
  }

  return {
    per100g,
    servingSize,
    source: 'USDA FoodData Central',
    fdcId: String(usdaFood.fdcId),
  };
}

// Find best USDA match for a food
async function findBestMatch(foodId, foodName, category, verbose) {
  // Try search override first, then food name
  const searchQuery = SEARCH_OVERRIDES[foodId] || `${foodName} raw`;

  if (verbose) {
    console.log(`  Searching USDA for: "${searchQuery}"`);
  }

  const results = await searchUSDA(searchQuery);

  if (results.length === 0) {
    // Try without 'raw'
    const fallbackResults = await searchUSDA(foodName);
    if (fallbackResults.length === 0) {
      return null;
    }
    return fallbackResults[0];
  }

  // Prefer Foundation foods over SR Legacy
  const foundationFood = results.find(f => f.dataType === 'Foundation');
  return foundationFood || results[0];
}

// Process a single food file
async function processFood(filePath, args) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const food = JSON.parse(content);

  // Skip if already has nutrition data (unless forced)
  if (food.nutrition?.per100g && Object.keys(food.nutrition.per100g).length > 0) {
    if (args.verbose) {
      console.log(`  Skipping ${food.name} - already has nutrition data`);
    }
    return { skipped: true, reason: 'already enriched' };
  }

  try {
    const match = await findBestMatch(food.id, food.name, food.category, args.verbose);

    if (!match) {
      console.log(`  ⚠ No USDA match found for: ${food.name}`);
      return { skipped: true, reason: 'no match' };
    }

    if (args.verbose) {
      console.log(`  Found: "${match.description}" (FDC ID: ${match.fdcId})`);
    }

    // Get detailed nutrition info
    const details = await getFoodDetails(match.fdcId);
    const nutrition = extractNutrition(details, food.category);

    if (Object.keys(nutrition.per100g).length === 0) {
      console.log(`  ⚠ No nutrient data available for: ${food.name}`);
      return { skipped: true, reason: 'no nutrients' };
    }

    // Update the food object
    food.nutrition = nutrition;

    if (args.dryRun) {
      console.log(`  [DRY RUN] Would update ${food.name}:`);
      console.log(`    Calories: ${nutrition.per100g.calories}, Protein: ${nutrition.per100g.protein}g`);
      console.log(`    FDC ID: ${nutrition.fdcId}`);
    } else {
      // Write updated file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(food, null, 2) + '\n');
      console.log(`  ✓ Updated ${food.name} (${nutrition.per100g.calories} kcal/100g)`);
    }

    return { success: true, food: food.name };
  } catch (error) {
    console.error(`  ✗ Error processing ${food.name}: ${error.message}`);
    return { error: true, reason: error.message };
  }
}

// Process all foods in a category
async function processCategory(categoryDir, args) {
  const categoryName = path.basename(categoryDir);
  const files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.json'));

  console.log(`\nProcessing ${categoryName} (${files.length} foods)...`);

  const stats = { success: 0, skipped: 0, errors: 0 };

  for (const file of files) {
    // Filter by specific food if provided
    if (args.food && !file.includes(args.food)) {
      continue;
    }

    const filePath = path.join(categoryDir, file);
    const result = await processFood(filePath, args);

    if (result.success) stats.success++;
    else if (result.skipped) stats.skipped++;
    else if (result.error) stats.errors++;

    // Rate limiting: wait 100ms between requests to stay well under 1000/hour
    await sleep(100);
  }

  return stats;
}

async function main() {
  const args = parseArgs();

  console.log('USDA Food Data Enrichment Script');
  console.log('================================');
  if (args.dryRun) console.log('Running in DRY RUN mode - no files will be modified\n');
  if (args.category) console.log(`Filtering to category: ${args.category}`);
  if (args.food) console.log(`Filtering to food: ${args.food}`);

  const categories = ['vegetables', 'fruits', 'proteins', 'grains', 'dairy', 'fats', 'sweeteners', 'beverages', 'condiments'];

  const totalStats = { success: 0, skipped: 0, errors: 0 };

  for (const category of categories) {
    // Filter by category if provided
    if (args.category && category !== args.category) {
      continue;
    }

    const categoryDir = path.join(DATA_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      console.log(`Skipping ${category} - directory not found`);
      continue;
    }

    const stats = await processCategory(categoryDir, args);
    totalStats.success += stats.success;
    totalStats.skipped += stats.skipped;
    totalStats.errors += stats.errors;
  }

  console.log('\n================================');
  console.log('Summary:');
  console.log(`  ✓ Updated: ${totalStats.success}`);
  console.log(`  ○ Skipped: ${totalStats.skipped}`);
  console.log(`  ✗ Errors: ${totalStats.errors}`);

  if (!args.dryRun && totalStats.success > 0) {
    console.log('\nRun `node scripts/generate-food-data.js` to regenerate TypeScript files.');
  }
}

main().catch(console.error);
