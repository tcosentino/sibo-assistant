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

// Load .env file if it exists (no dependencies needed)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
}

// USDA API key - use DEMO_KEY for testing or set USDA_API_KEY env var
// Get your own key at: https://fdc.nal.usda.gov/api-key-signup.html
const API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

// Nutrients to skip (category headers, not actual nutrients)
const SKIP_NUTRIENTS = new Set(['Proximates', 'Minerals', 'Vitamins', 'Lipids', 'Carbohydrates', 'Amino Acids', 'Other']);

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

// Fetch with retry for rate limiting
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url);

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.log(`  Rate limited, waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);
        continue;
      }
    }

    return response;
  }
}

// Search USDA for a food item
async function searchUSDA(query) {
  const url = `${USDA_API_BASE}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&dataType=${encodeURIComponent('Foundation,SR Legacy')}&pageSize=5`;

  const response = await fetchWithRetry(url);
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

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`USDA API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

// Extract nutrition data from USDA food details - keeps all nutrients as array
function extractNutrition(usdaFood, category) {
  const rawNutrients = usdaFood.foodNutrients || [];

  // Extract all nutrients, preserving USDA structure but simplified
  const nutrients = [];
  for (const item of rawNutrients) {
    const id = item.nutrient?.id || item.nutrientId;
    const number = item.nutrient?.number || item.nutrientNumber;
    const name = item.nutrient?.name || item.nutrientName;
    const unit = item.nutrient?.unitName || item.unitName;
    const amount = item.amount ?? item.value;

    // Skip category headers and items without values
    if (!name || SKIP_NUTRIENTS.has(name) || amount === undefined || amount === null) {
      continue;
    }

    nutrients.push({
      id: id || null,
      number: number || null,  // USDA's alternate identifier
      name,
      amount: Math.round(amount * 100) / 100,
      unit: unit || '',
    });
  }

  // Get all portion/serving options from USDA
  const portions = [];
  if (usdaFood.foodPortions && usdaFood.foodPortions.length > 0) {
    for (const portion of usdaFood.foodPortions) {
      if (portion.gramWeight) {
        portions.push({
          amount: portion.gramWeight,
          unit: 'g',
          description: portion.portionDescription || portion.modifier || `${portion.gramWeight}g`,
        });
      }
    }
  }

  // Add default serving for this category if no portions from USDA
  const defaultServing = DEFAULT_SERVINGS[category] || DEFAULT_SERVINGS.vegetable;
  if (portions.length === 0) {
    portions.push(defaultServing);
  }

  return {
    source: 'USDA FoodData Central',
    usdaFdcId: String(usdaFood.fdcId),
    usdaName: usdaFood.description || '',
    usdaDataType: usdaFood.dataType || 'Unknown',
    usdaPublicationDate: usdaFood.publicationDate || '',
    nutrients,
    usdaPortions: portions,  // All USDA serving sizes
    defaultServing,  // Category-based default for quick reference
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
  if (food.nutrition?.nutrients && food.nutrition.nutrients.length > 0) {
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

    if (nutrition.nutrients.length === 0) {
      console.log(`  ⚠ No nutrient data available for: ${food.name}`);
      return { skipped: true, reason: 'no nutrients' };
    }

    // Update the food object
    food.nutrition = nutrition;

    // Find key nutrients for summary display
    const energy = nutrition.nutrients.find(n => n.name.includes('Energy') && n.unit === 'kcal');
    const protein = nutrition.nutrients.find(n => n.name === 'Protein');

    if (args.dryRun) {
      console.log(`  [DRY RUN] Would update ${food.name}:`);
      console.log(`    ${nutrition.nutrients.length} nutrients from ${nutrition.usdaDataType}`);
      console.log(`    Energy: ${energy?.amount ?? 'N/A'} kcal, Protein: ${protein?.amount ?? 'N/A'}g`);
      console.log(`    USDA FDC ID: ${nutrition.usdaFdcId}`);
    } else {
      // Write updated file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(food, null, 2) + '\n');
      console.log(`  ✓ Updated ${food.name} (${nutrition.nutrients.length} nutrients, ${energy?.amount ?? '?'} kcal/100g)`);
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

    // Rate limiting: wait between requests
    // DEMO_KEY has ~30 req/hour limit, real keys have 1000/hour
    const delayMs = API_KEY === 'DEMO_KEY' ? 2000 : 200;
    await sleep(delayMs);
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
