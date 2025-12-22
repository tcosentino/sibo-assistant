#!/usr/bin/env node

/**
 * FODMAP Data Gathering Script
 *
 * Generates comprehensive FODMAP food data using Claude AI based on
 * established research (Monash University, peer-reviewed studies).
 *
 * Usage (from server directory):
 *   npm run gather-fodmap -- [options]
 *   node scripts/gather-fodmap-data.js [options]
 *
 * The script automatically loads ANTHROPIC_API_KEY from server/.env
 *
 * Options:
 *   --category <name>   Only process a specific category (vegetables, fruits, proteins, grains, dairy, fats, sweeteners, beverages, condiments)
 *   --dry-run           Show what would be generated without saving
 *   --batch-size <n>    Number of foods to process per batch (default: 5)
 *   --delay <ms>        Delay between batches in ms (default: 2000)
 *   --force             Overwrite existing food files
 *   --list              List all foods to be generated and exit
 *
 * Examples:
 *   # Dry run for sweeteners only
 *   ANTHROPIC_API_KEY=sk-xxx npm run gather-fodmap -- --category sweeteners --dry-run
 *
 *   # Generate all vegetables with larger batches
 *   ANTHROPIC_API_KEY=sk-xxx npm run gather-fodmap -- --category vegetables --batch-size 10
 *
 *   # List all foods that would be generated
 *   npm run gather-fodmap -- --list
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from server directory
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

// Configuration
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'foods');
const SCHEMA_PATH = path.join(DATA_DIR, 'schema.json');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  category: null,
  dryRun: args.includes('--dry-run'),
  batchSize: 5,
  delay: 2000,
  force: args.includes('--force'),
  list: args.includes('--list'),
};

// Parse named arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--category' && args[i + 1]) {
    options.category = args[i + 1];
    i++;
  } else if (args[i] === '--batch-size' && args[i + 1]) {
    options.batchSize = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--delay' && args[i + 1]) {
    options.delay = parseInt(args[i + 1], 10);
    i++;
  }
}

// ============================================================================
// COMPREHENSIVE FOOD LIST - Common US grocery store and restaurant ingredients
// ============================================================================

const FOODS_TO_GENERATE = {
  vegetables: [
    // Leafy greens
    'Swiss Chard', 'Collard Greens', 'Mustard Greens', 'Watercress', 'Endive',
    'Radicchio', 'Romaine Lettuce', 'Iceberg Lettuce', 'Butter Lettuce', 'Mixed Greens',
    'Microgreens', 'Sprouts (Bean)', 'Sprouts (Alfalfa)',

    // Cruciferous
    'Brussels Sprouts', 'Kohlrabi', 'Broccolini', 'Chinese Broccoli (Gai Lan)',
    'Napa Cabbage', 'Red Cabbage', 'Savoy Cabbage',

    // Alliums (high FODMAP typically)
    'Shallots', 'Leeks (Green Part Only)', 'Ramps', 'Pearl Onions',

    // Root vegetables
    'Rutabaga', 'Celeriac', 'Jicama', 'Daikon Radish', 'Horseradish',
    'Taro Root', 'Yuca (Cassava)', 'Lotus Root', 'Water Chestnuts',

    // Squash varieties
    'Acorn Squash', 'Spaghetti Squash', 'Delicata Squash', 'Kabocha Squash',
    'Yellow Squash', 'Pattypan Squash', 'Chayote',

    // Peppers
    'Jalapeño Pepper', 'Serrano Pepper', 'Habanero Pepper', 'Poblano Pepper',
    'Anaheim Pepper', 'Banana Pepper', 'Shishito Pepper', 'Bell Pepper (Yellow)',
    'Bell Pepper (Orange)', 'Pimiento',

    // Other vegetables
    'Artichoke', 'Hearts of Palm', 'Fennel', 'Okra', 'Kohlrabi',
    'Bamboo Shoots', 'Baby Corn', 'Snow Peas', 'Sugar Snap Peas',
    'Green Peas', 'Edamame', 'Bean Sprouts',

    // Mushroom varieties
    'Shiitake Mushroom', 'Portobello Mushroom', 'Cremini Mushroom',
    'Enoki Mushroom', 'King Trumpet Mushroom', 'Maitake Mushroom',
    'Chanterelle Mushroom', 'Porcini Mushroom', 'Morel Mushroom',

    // Cooking aromatics
    'Lemongrass', 'Galangal', 'Ginger Root (Fresh)',

    // Sea vegetables
    'Nori (Seaweed)', 'Wakame', 'Kelp', 'Dulse',
  ],

  fruits: [
    // Berries
    'Blackberry', 'Cranberry', 'Gooseberry', 'Mulberry', 'Elderberry',
    'Açaí Berry', 'Goji Berry', 'Boysenberry', 'Lingonberry',

    // Stone fruits
    'Apricot', 'Nectarine', 'Plum', 'Prune', 'Date',

    // Citrus
    'Grapefruit', 'Tangerine', 'Clementine', 'Blood Orange', 'Meyer Lemon',
    'Key Lime', 'Kumquat', 'Pomelo', 'Yuzu',

    // Tropical fruits
    'Passion Fruit', 'Dragon Fruit (Pitaya)', 'Guava', 'Lychee', 'Longan',
    'Rambutan', 'Jackfruit', 'Durian', 'Starfruit (Carambola)', 'Persimmon',
    'Pomegranate', 'Fig', 'Tamarind', 'Plantain',

    // Melons
    'Casaba Melon', 'Crenshaw Melon', 'Santa Claus Melon',

    // Other fruits
    'Quince', 'Cherimoya', 'Sapote', 'Soursop',

    // Dried fruits
    'Dried Cranberries', 'Dried Apricots', 'Dried Figs', 'Raisins',
    'Golden Raisins', 'Dried Mango', 'Dried Pineapple',
  ],

  proteins: [
    // Poultry
    'Chicken Breast', 'Chicken Thigh', 'Chicken Wings', 'Chicken Liver',
    'Turkey Breast', 'Turkey Ground', 'Duck Breast', 'Duck Confit',
    'Cornish Hen', 'Quail', 'Pheasant',

    // Beef cuts
    'Beef Ribeye', 'Beef Sirloin', 'Beef Tenderloin (Filet Mignon)', 'Beef Brisket',
    'Beef Short Ribs', 'Beef Chuck', 'Beef Flank Steak', 'Beef Skirt Steak',
    'Ground Beef', 'Beef Liver', 'Beef Tongue', 'Veal',

    // Pork cuts
    'Pork Chop', 'Pork Tenderloin', 'Pork Belly', 'Pork Shoulder',
    'Pork Ribs', 'Ground Pork', 'Ham', 'Prosciutto', 'Pancetta',
    'Chorizo', 'Italian Sausage', 'Bratwurst', 'Andouille Sausage',

    // Lamb & Game
    'Lamb Chop', 'Lamb Leg', 'Lamb Shank', 'Ground Lamb',
    'Venison', 'Bison', 'Rabbit', 'Goat',

    // Fish
    'Halibut', 'Sea Bass', 'Branzino', 'Mahi Mahi', 'Snapper',
    'Grouper', 'Tilapia', 'Catfish', 'Trout', 'Sardines',
    'Anchovies', 'Mackerel', 'Swordfish', 'Ahi Tuna', 'Yellowtail',

    // Shellfish
    'Lobster', 'Oysters', 'Clams', 'Mussels', 'Calamari (Squid)',
    'Octopus', 'Crawfish', 'Langoustine', 'Sea Urchin (Uni)',

    // Plant proteins
    'Seitan', 'Textured Vegetable Protein (TVP)', 'Beyond Meat', 'Impossible Burger',
    'Jackfruit (as meat substitute)', 'Tempeh (Plain)', 'Tofu (Silken)',

    // Eggs
    'Duck Eggs', 'Quail Eggs',

    // Legumes (often high FODMAP)
    'Black Beans', 'Pinto Beans', 'Kidney Beans', 'Navy Beans',
    'Cannellini Beans', 'Chickpeas (Garbanzo)', 'Lentils (Green)',
    'Lentils (Red)', 'Lentils (Black)', 'Split Peas', 'Black-Eyed Peas',
    'Lima Beans', 'Fava Beans', 'Mung Beans', 'Adzuki Beans',

    // Deli meats
    'Roast Beef (Deli)', 'Turkey (Deli)', 'Pastrami', 'Corned Beef',
    'Mortadella', 'Capicola', 'Salami', 'Pepperoni',
  ],

  grains: [
    // Rice varieties
    'Jasmine Rice', 'Basmati Rice', 'Arborio Rice', 'Sushi Rice',
    'Wild Rice', 'Black Rice (Forbidden Rice)', 'Red Rice',

    // Ancient grains
    'Amaranth', 'Millet', 'Sorghum', 'Teff', 'Buckwheat',
    'Farro', 'Spelt', 'Kamut', 'Freekeh', 'Bulgur',

    // Wheat products
    'Couscous', 'Orzo', 'Fregola', 'Semolina',

    // Gluten-free grains/starches
    'Cornmeal', 'Grits', 'Corn Flour', 'Tapioca', 'Arrowroot',
    'Potato Starch', 'Rice Flour', 'Almond Flour', 'Coconut Flour',
    'Chickpea Flour', 'Cassava Flour', 'Oat Flour',

    // Bread varieties
    'Ciabatta', 'Baguette', 'Focaccia', 'Pita Bread', 'Naan',
    'Rye Bread', 'Pumpernickel', 'Brioche', 'Challah',
    'English Muffin', 'Bagel', 'Croissant',

    // Pasta shapes
    'Spaghetti', 'Fettuccine', 'Penne', 'Rigatoni', 'Fusilli',
    'Linguine', 'Angel Hair', 'Lasagna Noodles', 'Egg Noodles',
    'Rice Noodles', 'Glass Noodles (Cellophane)', 'Udon', 'Soba',
    'Ramen Noodles',

    // Breakfast cereals/grains
    'Cream of Rice', 'Cream of Wheat', 'Cornflakes', 'Rice Krispies',
    'Cheerios', 'Granola', 'Muesli', 'Steel Cut Oats', 'Rolled Oats',

    // Crackers and snacks
    'Rice Cakes', 'Corn Chips', 'Tortilla Chips', 'Pretzels',
    'Graham Crackers', 'Saltine Crackers', 'Matzo',
  ],

  dairy: [
    // Milk types
    'Whole Milk', 'Skim Milk', '2% Milk', 'Half and Half', 'Heavy Cream',
    'Whipping Cream', 'Evaporated Milk', 'Condensed Milk',
    'Buttermilk', 'Kefir', 'Goat Milk', 'Sheep Milk',

    // Cheese varieties
    'Mozzarella (Fresh)', 'Mozzarella (Low-Moisture)', 'Burrata',
    'Ricotta', 'Cottage Cheese', 'Cream Cheese', 'Mascarpone',
    'Brie', 'Camembert', 'Gorgonzola', 'Roquefort', 'Stilton',
    'Gouda', 'Havarti', 'Muenster', 'Provolone', 'Swiss Cheese',
    'Gruyère', 'Emmental', 'Pecorino Romano', 'Manchego',
    'Queso Fresco', 'Cotija', 'Paneer', 'Halloumi',
    'Goat Cheese (Chèvre)', 'Blue Cheese', 'American Cheese',
    'Pepper Jack', 'Colby', 'Monterey Jack',

    // Yogurt types
    'Regular Yogurt', 'Skyr (Icelandic Yogurt)', 'Australian Yogurt',

    // Cream/sour products
    'Sour Cream', 'Crème Fraîche', 'Clotted Cream',

    // Non-dairy alternatives
    'Oat Milk', 'Soy Milk', 'Coconut Milk', 'Cashew Milk', 'Rice Milk',
    'Hemp Milk', 'Macadamia Milk', 'Pea Milk',
    'Coconut Cream', 'Coconut Yogurt', 'Almond Yogurt', 'Oat Yogurt',
    'Vegan Cheese', 'Nutritional Yeast',
  ],

  fats: [
    // Cooking oils
    'Vegetable Oil', 'Canola Oil', 'Sunflower Oil', 'Safflower Oil',
    'Peanut Oil', 'Grapeseed Oil', 'Avocado Oil', 'Walnut Oil',
    'Flaxseed Oil', 'Hemp Oil', 'MCT Oil', 'Ghee (Clarified Butter)',

    // Nut butters
    'Peanut Butter', 'Almond Butter', 'Cashew Butter', 'Sunflower Seed Butter',
    'Tahini (Sesame Paste)', 'Hazelnut Spread',

    // Nuts
    'Almonds', 'Cashews', 'Walnuts', 'Pecans', 'Pistachios',
    'Hazelnuts', 'Macadamia Nuts', 'Brazil Nuts', 'Pine Nuts',
    'Peanuts', 'Chestnuts', 'Coconut (Shredded)', 'Coconut (Fresh)',

    // Seeds
    'Chia Seeds', 'Flax Seeds', 'Hemp Seeds', 'Pumpkin Seeds (Pepitas)',
    'Sunflower Seeds', 'Sesame Seeds', 'Poppy Seeds',

    // Other fats
    'Lard', 'Tallow', 'Duck Fat', 'Bacon Fat', 'Shortening',
    'Margarine', 'Mayonnaise (Commercial)',
  ],

  sweeteners: [
    // Natural sweeteners
    'Cane Sugar', 'Brown Sugar', 'Powdered Sugar (Confectioners)',
    'Turbinado Sugar', 'Coconut Sugar', 'Date Sugar', 'Molasses',
    'Blackstrap Molasses', 'Agave Nectar', 'Brown Rice Syrup',
    'Corn Syrup', 'Golden Syrup', 'Treacle',

    // Sugar alcohols (polyols - often problematic)
    'Erythritol', 'Xylitol', 'Sorbitol', 'Mannitol', 'Maltitol', 'Isomalt',

    // Artificial sweeteners
    'Stevia', 'Monk Fruit (Luo Han Guo)', 'Aspartame', 'Sucralose (Splenda)',
    'Saccharin', 'Acesulfame K',

    // Syrups
    'Simple Syrup', 'Grenadine', 'Chocolate Syrup', 'Caramel Sauce',
  ],

  beverages: [
    // Coffee varieties
    'Espresso', 'Cold Brew Coffee', 'Decaf Coffee', 'Instant Coffee',

    // Tea varieties
    'Black Tea', 'Earl Grey', 'English Breakfast Tea', 'Chai Tea',
    'Oolong Tea', 'White Tea', 'Matcha', 'Rooibos Tea',
    'Chamomile Tea', 'Peppermint Tea', 'Ginger Tea', 'Hibiscus Tea',
    'Dandelion Tea', 'Fennel Tea', 'Yerba Mate',

    // Juices
    'Orange Juice', 'Apple Juice', 'Grape Juice', 'Cranberry Juice',
    'Pomegranate Juice', 'Pineapple Juice', 'Tomato Juice', 'Carrot Juice',
    'Beet Juice', 'Celery Juice', 'Green Juice',

    // Other beverages
    'Coconut Water', 'Aloe Vera Juice', 'Kombucha',
    'Sparkling Water', 'Tonic Water', 'Club Soda',
    'Ginger Ale', 'Root Beer', 'Cola', 'Lemon-Lime Soda',

    // Alcoholic (for reference)
    'Beer', 'Wine (Red)', 'Wine (White)', 'Champagne', 'Sake',
    'Vodka', 'Gin', 'Rum', 'Whiskey', 'Tequila',
    'Hard Cider', 'Hard Seltzer',

    // Smoothie/shake bases
    'Protein Powder (Whey)', 'Protein Powder (Plant-Based)',
  ],

  condiments: [
    // Sauces
    'Ketchup', 'BBQ Sauce', 'Hot Sauce', 'Sriracha', 'Tabasco',
    'Worcestershire Sauce', 'Teriyaki Sauce', 'Hoisin Sauce',
    'Oyster Sauce', 'Sweet Chili Sauce', 'Chili Garlic Sauce',
    'Ponzu Sauce', 'Miso Paste (White)', 'Miso Paste (Red)',
    'Gochujang', 'Sambal Oelek', 'Harissa', 'Chimichurri',
    'Pesto', 'Romesco Sauce', 'Tahini Sauce', 'Tzatziki',
    'Hummus', 'Baba Ganoush', 'Guacamole', 'Salsa (Fresh)',
    'Salsa (Jarred)', 'Pico de Gallo', 'Enchilada Sauce',
    'Mole Sauce', 'Adobo Sauce', 'Buffalo Sauce',

    // Dressings
    'Ranch Dressing', 'Caesar Dressing', 'Italian Dressing',
    'Blue Cheese Dressing', 'Thousand Island', 'French Dressing',
    'Honey Mustard Dressing', 'Balsamic Vinaigrette', 'Greek Dressing',

    // Vinegars
    'White Wine Vinegar', 'Red Wine Vinegar', 'Sherry Vinegar',
    'Rice Vinegar', 'Champagne Vinegar', 'Malt Vinegar',

    // Mustards
    'Dijon Mustard', 'Whole Grain Mustard', 'Yellow Mustard',
    'Honey Mustard', 'Spicy Brown Mustard', 'English Mustard',

    // Pickled items
    'Pickles (Dill)', 'Pickles (Bread and Butter)', 'Pickled Jalapeños',
    'Pickled Ginger', 'Pickled Onions', 'Capers', 'Olives (Green)',
    'Olives (Kalamata)', 'Olives (Black)', 'Sundried Tomatoes',
    'Roasted Red Peppers', 'Artichoke Hearts (Jarred)', 'Pepperoncini',
    'Cornichons', 'Kimchi', 'Sauerkraut',

    // Spices & seasonings
    'Garlic Powder', 'Onion Powder', 'Smoked Paprika', 'Cayenne Pepper',
    'Chili Powder', 'Curry Powder', 'Garam Masala', 'Chinese Five Spice',
    'Italian Seasoning', 'Herbs de Provence', 'Old Bay Seasoning',
    'Cajun Seasoning', 'Taco Seasoning', 'Everything Bagel Seasoning',
    'Za\'atar', 'Sumac', 'Saffron', 'Cardamom', 'Coriander',
    'Fennel Seeds', 'Caraway Seeds', 'Dill Weed', 'Thyme',
    'Oregano', 'Marjoram', 'Sage', 'Bay Leaves', 'Cloves',
    'Nutmeg', 'Allspice', 'Star Anise', 'Vanilla Extract',
    'Almond Extract', 'Lemon Zest', 'Orange Zest',

    // Asian condiments
    'Mirin', 'Shaoxing Wine', 'Toasted Sesame Oil', 'Chili Oil',
    'Coconut Aminos', 'Tamari', 'Thai Fish Sauce', 'Tamarind Paste',

    // Spreads
    'Jam (Strawberry)', 'Jam (Raspberry)', 'Marmalade', 'Apple Butter',
    'Fruit Preserves', 'Nutella', 'Cookie Butter',
  ],
};

// ============================================================================
// FODMAP GENERATION PROMPT
// ============================================================================

const FODMAP_SYSTEM_PROMPT = `You are a FODMAP nutrition expert with deep knowledge of:
- Monash University FODMAP research and app data
- Peer-reviewed studies on FODMAPs and digestive health
- SIBO (Small Intestinal Bacterial Overgrowth) dietary considerations

Your task is to generate accurate FODMAP food data in JSON format.

CRITICAL GUIDELINES:
1. Be accurate - if you're uncertain about specific gram amounts, use conservative estimates
2. Low FODMAP serving sizes are typically: vegetables 75-100g, fruits 40-80g
3. FODMAPs are dose-dependent - many foods are low FODMAP at small servings
4. Consider ALL FODMAP types: fructose, lactose, fructans, galactans, polyols-sorbitol, polyols-mannitol
5. Onions, garlic, wheat, and most legumes are high FODMAP
6. Lactose-free dairy and aged hard cheeses are typically low FODMAP
7. Most plain proteins (meat, fish, eggs) are naturally FODMAP-free
8. Consider regional naming (US grocery store context)

FODMAP TYPE GUIDE:
- fructose: excess free fructose (apples, pears, honey, HFCS, mango)
- lactose: dairy milk, soft cheeses, ice cream, yogurt
- fructans: wheat, rye, onion, garlic, inulin, artichoke, watermelon
- galactans (GOS): legumes, beans, lentils, chickpeas
- polyols-sorbitol: stone fruits (peach, plum), apple, pear, avocado
- polyols-mannitol: mushrooms, cauliflower, snow peas, watermelon

Output valid JSON only, no markdown code blocks, no extra text.`;

function buildFoodPrompt(foodName, category) {
  return `Generate FODMAP data for: "${foodName}" (category: ${category})

Return a JSON object with this exact structure:
{
  "id": "lowercase-hyphenated-id",
  "name": "${foodName}",
  "aliases": ["other common names if any"],
  "category": "${category}",
  "subcategory": "appropriate-subcategory",
  "fodmapRating": "low|moderate|high",
  "fodmapTypes": ["only include types this food contains"],
  "servingSizes": {
    "low": {
      "grams": number,
      "description": "e.g., About 1/2 cup",
      "cups": "e.g., 1/2 cup"
    },
    "moderate": {
      "grams": number,
      "description": "description",
      "cups": "measurement"
    },
    "high": {
      "grams": number,
      "description": "description",
      "cups": "measurement"
    }
  },
  "siboNotes": "Brief SIBO-specific guidance (1-2 sentences)",
  "preparationTips": ["2-4 practical tips"],
  "alternatives": ["2-4 lower-FODMAP alternatives if this is moderate/high FODMAP"],
  "pairsWellWith": ["3-5 complementary low-FODMAP foods"],
  "nutritionalHighlights": ["3-4 key nutrients"],
  "source": "FODMAP research (Monash University guidelines)",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}"
}

RULES:
- If food is naturally FODMAP-free (like plain meat), fodmapTypes should be []
- If food is low FODMAP at any reasonable serving, only include "low" in servingSizes
- If food has no safe serving, rate it "high" and explain in siboNotes
- For "alternatives", suggest similar foods that are lower FODMAP
- Be specific with gram amounts based on Monash research
- subcategory examples: leafy-green, cruciferous, allium, root, squash, pepper, mushroom, citrus, berry, stone-fruit, tropical, poultry, beef, pork, seafood, legume, rice, wheat, pasta, hard-cheese, soft-cheese, milk, nut, seed, oil, sugar, alcohol, sauce, spice, vinegar, etc.`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCategoryDir(category) {
  // Map singular to plural directory names
  const categoryMap = {
    'vegetable': 'vegetables',
    'fruit': 'fruits',
    'protein': 'proteins',
    'grain': 'grains',
    'dairy': 'dairy',
    'fat': 'fats',
    'sweetener': 'sweeteners',
    'beverage': 'beverages',
    'condiment': 'condiments',
  };
  return categoryMap[category] || category;
}

function getExistingFoods() {
  const existing = new Set();
  const categories = ['vegetables', 'fruits', 'proteins', 'grains', 'dairy', 'fats', 'sweeteners', 'beverages', 'condiments'];

  for (const category of categories) {
    const dirPath = path.join(DATA_DIR, category);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && f !== 'schema.json');
      for (const file of files) {
        existing.add(file.replace('.json', ''));
      }
    }
  }

  return existing;
}

function generateId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateFoodData(data) {
  const required = ['id', 'name', 'category', 'fodmapRating', 'servingSizes'];
  const validRatings = ['low', 'moderate', 'high'];
  const validCategories = ['vegetable', 'fruit', 'protein', 'grain', 'dairy', 'fat', 'sweetener', 'beverage', 'condiment'];
  const validFodmapTypes = ['fructose', 'lactose', 'fructans', 'galactans', 'polyols-sorbitol', 'polyols-mannitol'];

  for (const field of required) {
    if (!data[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!validRatings.includes(data.fodmapRating)) {
    return { valid: false, error: `Invalid fodmapRating: ${data.fodmapRating}` };
  }

  if (!validCategories.includes(data.category)) {
    return { valid: false, error: `Invalid category: ${data.category}` };
  }

  if (data.fodmapTypes && !Array.isArray(data.fodmapTypes)) {
    return { valid: false, error: 'fodmapTypes must be an array' };
  }

  if (data.fodmapTypes) {
    for (const type of data.fodmapTypes) {
      if (!validFodmapTypes.includes(type)) {
        return { valid: false, error: `Invalid fodmapType: ${type}` };
      }
    }
  }

  return { valid: true };
}

// ============================================================================
// MAIN GENERATION LOGIC
// ============================================================================

async function generateFoodData(anthropic, foodName, category) {
  const prompt = buildFoodPrompt(foodName, category);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: FODMAP_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonText = content.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const data = JSON.parse(jsonText);

  // Validate the data
  const validation = validateFoodData(data);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.error}`);
  }

  return data;
}

async function saveFoodData(data) {
  const categoryDir = path.join(DATA_DIR, getCategoryDir(data.category));

  // Ensure directory exists
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const filePath = path.join(categoryDir, `${data.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');

  return filePath;
}

async function processFood(anthropic, foodName, category, existingFoods, stats) {
  const expectedId = generateId(foodName);

  // Check if already exists
  if (existingFoods.has(expectedId) && !options.force) {
    console.log(`  ⏭️  Skipping "${foodName}" (already exists)`);
    stats.skipped++;
    return;
  }

  try {
    console.log(`  🔄 Generating "${foodName}"...`);
    const data = await generateFoodData(anthropic, foodName, category);

    if (options.dryRun) {
      console.log(`  ✅ Would save: ${data.id}.json (${data.fodmapRating} FODMAP)`);
      stats.generated++;
    } else {
      const filePath = await saveFoodData(data);
      console.log(`  ✅ Saved: ${path.basename(filePath)} (${data.fodmapRating} FODMAP)`);
      stats.generated++;
    }
  } catch (error) {
    console.log(`  ❌ Error for "${foodName}": ${error.message}`);
    stats.errors.push({ food: foodName, category, error: error.message });
  }
}

async function main() {
  console.log('🥗 FODMAP Data Gathering Script\n');

  // Get existing foods
  const existingFoods = getExistingFoods();

  // Collect all foods to process
  let foodsToProcess = [];

  for (const [category, foods] of Object.entries(FOODS_TO_GENERATE)) {
    if (options.category && category !== options.category) {
      continue;
    }

    // Map category to singular form for data
    const singularCategory = category.replace(/s$/, '').replace(/ie$/, 'y');

    for (const food of foods) {
      foodsToProcess.push({ name: food, category: singularCategory });
    }
  }

  // Handle --list option
  if (options.list) {
    console.log(`📊 Existing foods: ${existingFoods.size}`);
    console.log(`📝 Foods to generate: ${foodsToProcess.length}\n`);

    for (const [category, foods] of Object.entries(FOODS_TO_GENERATE)) {
      if (options.category && category !== options.category) {
        continue;
      }
      console.log(`\n📁 ${category.toUpperCase()} (${foods.length}):`);
      for (const food of foods) {
        const id = generateId(food);
        const exists = existingFoods.has(id);
        const marker = exists ? '✓' : '○';
        console.log(`   ${marker} ${food}`);
      }
    }

    console.log('\n✓ = already exists, ○ = will be generated');
    return;
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    console.error('   Usage: ANTHROPIC_API_KEY=your-key node scripts/gather-fodmap-data.js');
    process.exit(1);
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log('📋 Options:');
  console.log(`   Category: ${options.category || 'all'}`);
  console.log(`   Batch size: ${options.batchSize}`);
  console.log(`   Delay: ${options.delay}ms`);
  console.log(`   Dry run: ${options.dryRun}`);
  console.log(`   Force overwrite: ${options.force}\n`);

  console.log(`📊 Existing foods: ${existingFoods.size}\n`);
  console.log(`📝 Foods to process: ${foodsToProcess.length}\n`);

  // Stats tracking
  const stats = {
    generated: 0,
    skipped: 0,
    errors: [],
  };

  // Process in batches
  for (let i = 0; i < foodsToProcess.length; i += options.batchSize) {
    const batch = foodsToProcess.slice(i, i + options.batchSize);
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const totalBatches = Math.ceil(foodsToProcess.length / options.batchSize);

    console.log(`\n📦 Batch ${batchNum}/${totalBatches}:`);

    for (const { name, category } of batch) {
      await processFood(anthropic, name, category, existingFoods, stats);
    }

    // Add delay between batches (except for last batch)
    if (i + options.batchSize < foodsToProcess.length) {
      console.log(`   ⏳ Waiting ${options.delay}ms before next batch...`);
      await sleep(options.delay);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Generated: ${stats.generated}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const { food, category, error } of stats.errors) {
      console.log(`   - ${food} (${category}): ${error}`);
    }
  }

  if (!options.dryRun && stats.generated > 0) {
    console.log('\n💡 Next steps:');
    console.log('   1. Review generated files in data/foods/');
    console.log('   2. Run: node scripts/generate-food-data.js');
    console.log('   3. Rebuild the app');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
