// Food database for SIBO assistant
// This is a condensed version optimized for the system prompt

export interface Food {
  id: string;
  name: string;
  aliases?: string[];
  fodmapRating: 'low' | 'moderate' | 'high';
  fodmapTypes: string[];
  safeServing?: string;
  notes: string;
  alternatives?: string[];
}

export const foodDatabase: Food[] = [
  // LOW FODMAP - Safe
  {
    id: 'carrot',
    name: 'Carrot',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'No measurable FODMAPs. One of the safest vegetables.',
  },
  {
    id: 'potato',
    name: 'Potato',
    aliases: ['white potato', 'russet'],
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'FODMAP-free. Excellent safe carbohydrate source.',
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'No FODMAPs. Can be eaten freely.',
  },
  {
    id: 'lettuce',
    name: 'Lettuce',
    aliases: ['romaine', 'iceberg', 'butter lettuce'],
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (1.5 cups)',
    notes: 'All varieties are safe with no upper limit.',
  },
  {
    id: 'spinach',
    name: 'Spinach',
    aliases: ['baby spinach'],
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (1.5 cups)',
    notes: 'Excellent choice with minimal FODMAPs.',
  },
  {
    id: 'kale',
    name: 'Kale',
    fodmapRating: 'low',
    fodmapTypes: ['galactans'],
    safeServing: '75g (1 cup)',
    notes: 'Safe up to large portions. Only becomes moderate at 200g+.',
  },
  {
    id: 'bell-pepper-green',
    name: 'Bell Pepper (Green)',
    aliases: ['green pepper', 'green capsicum'],
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'Green peppers are the best choice - lower FODMAP than red/yellow.',
  },
  {
    id: 'broccoli',
    name: 'Broccoli',
    fodmapRating: 'low',
    fodmapTypes: ['fructans', 'polyols-sorbitol'],
    safeServing: '75g florets',
    notes: 'IMPORTANT: Use florets only, not stalks. Stalks are higher FODMAP.',
  },
  {
    id: 'bok-choy',
    name: 'Bok Choy',
    aliases: ['pak choi'],
    fodmapRating: 'low',
    fodmapTypes: ['fructans', 'polyols-sorbitol'],
    safeServing: '75g (1 cup)',
    notes: 'Great for Asian dishes. Safe at standard portions.',
  },
  {
    id: 'green-beans',
    name: 'Green Beans',
    aliases: ['string beans', 'french beans'],
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'Safe unlike most legumes. No problematic galactans.',
  },
  {
    id: 'tomato',
    name: 'Tomato',
    aliases: ['roma tomato', 'cherry tomato'],
    fodmapRating: 'low',
    fodmapTypes: ['fructose'],
    safeServing: '65g (1 small tomato)',
    notes: 'Generally safe. Watch for added onion/garlic in sauces.',
  },
  {
    id: 'eggplant',
    name: 'Eggplant',
    aliases: ['aubergine'],
    fodmapRating: 'low',
    fodmapTypes: ['fructans', 'polyols-sorbitol'],
    safeServing: '75g (0.5 cup)',
    notes: 'Well tolerated at standard portions.',
  },
  {
    id: 'ginger',
    name: 'Ginger',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '10g (1 tsp)',
    notes: 'BONUS: Acts as natural prokinetic - supports gut motility!',
  },
  {
    id: 'chives',
    name: 'Chives',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '15g (1 tbsp)',
    notes: 'THE go-to onion substitute. Safe and flavorful.',
  },
  {
    id: 'scallion',
    name: 'Scallion (Green Onion)',
    aliases: ['green onion', 'spring onion'],
    fodmapRating: 'low',
    fodmapTypes: ['fructans'],
    safeServing: '75g green parts',
    notes: 'CRITICAL: Only GREEN parts are safe. White bulb is HIGH FODMAP.',
    alternatives: ['chives'],
  },
  {
    id: 'mushroom-oyster',
    name: 'Oyster Mushroom',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (1 cup)',
    notes: 'One of the few safe mushrooms. Most others are high FODMAP.',
  },
  {
    id: 'parsnip',
    name: 'Parsnip',
    fodmapRating: 'low',
    fodmapTypes: ['polyols-sorbitol'],
    safeServing: '75g (0.5 cup)',
    notes: 'Safe at standard portions. Sweet, nutty flavor.',
  },
  {
    id: 'turnip',
    name: 'Turnip',
    fodmapRating: 'low',
    fodmapTypes: [],
    safeServing: '75g (0.5 cup)',
    notes: 'Great low-FODMAP root vegetable.',
  },
  {
    id: 'cabbage-white',
    name: 'Cabbage (White/Green)',
    fodmapRating: 'low',
    fodmapTypes: ['polyols-sorbitol'],
    safeServing: '75g (0.75 cup)',
    notes: 'Safe at standard portions. Check fermented versions for additives.',
  },

  // MODERATE - Portion Control Needed
  {
    id: 'sweet-potato',
    name: 'Sweet Potato',
    aliases: ['yam'],
    fodmapRating: 'moderate',
    fodmapTypes: ['polyols-mannitol'],
    safeServing: '75g raw weight',
    notes: 'Needs careful portion control. Regular potatoes are safer.',
    alternatives: ['potato'],
  },
  {
    id: 'zucchini',
    name: 'Zucchini',
    aliases: ['courgette'],
    fodmapRating: 'moderate',
    fodmapTypes: ['fructans'],
    safeServing: '65g (0.5 cup)',
    notes: 'Watch portions - becomes high FODMAP at 85g+.',
  },
  {
    id: 'bell-pepper-red',
    name: 'Bell Pepper (Red)',
    fodmapRating: 'moderate',
    fodmapTypes: ['fructose', 'fructans'],
    safeServing: '43g (0.33 cup)',
    notes: 'Higher FODMAP than green due to more fructose.',
    alternatives: ['bell-pepper-green'],
  },
  {
    id: 'beetroot',
    name: 'Beetroot',
    aliases: ['beet', 'beets'],
    fodmapRating: 'moderate',
    fodmapTypes: ['fructans', 'galactans'],
    safeServing: '20g (2 slices)',
    notes: 'Very small safe serving. CANNED beets are safer (60g).',
  },
  {
    id: 'butternut-squash',
    name: 'Butternut Squash',
    fodmapRating: 'moderate',
    fodmapTypes: ['fructans', 'galactans', 'polyols-mannitol'],
    safeServing: '45g (0.33 cup)',
    notes: 'Very small safe serving. Use potato or pumpkin instead.',
    alternatives: ['potato', 'carrot'],
  },
  {
    id: 'cauliflower',
    name: 'Cauliflower',
    fodmapRating: 'moderate',
    fodmapTypes: ['polyols-mannitol'],
    safeServing: '50g (0.33 cup)',
    notes: 'Higher FODMAP than most veggies. Many find it problematic.',
    alternatives: ['broccoli'],
  },
  {
    id: 'celery',
    name: 'Celery',
    fodmapRating: 'moderate',
    fodmapTypes: ['polyols-mannitol'],
    safeServing: '15g (2 tbsp diced)',
    notes: 'VERY small safe serving. Use cucumber for crunch instead.',
    alternatives: ['cucumber'],
  },
  {
    id: 'leek',
    name: 'Leek',
    fodmapRating: 'high',
    fodmapTypes: ['fructans'],
    safeServing: '67g green leaves only',
    notes: 'Like scallions: GREEN parts only are safe. White bulb is high FODMAP.',
    alternatives: ['chives', 'scallion'],
  },

  // HIGH FODMAP - Avoid
  {
    id: 'garlic',
    name: 'Garlic',
    fodmapRating: 'high',
    fodmapTypes: ['fructans'],
    safeServing: 'None - avoid',
    notes: 'EXTREMELY high in fructans. Even 1 clove is problematic. USE GARLIC-INFUSED OIL instead - fructans are water-soluble, not oil-soluble!',
    alternatives: ['garlic-infused oil', 'chives', 'asafoetida'],
  },
  {
    id: 'onion',
    name: 'Onion',
    aliases: ['white onion', 'yellow onion', 'red onion'],
    fodmapRating: 'high',
    fodmapTypes: ['fructans'],
    safeServing: 'None - avoid',
    notes: 'One of the highest FODMAP foods. NO safe serving. Check ALL labels - hidden in many foods.',
    alternatives: ['chives', 'scallion green parts', 'asafoetida'],
  },
  {
    id: 'asparagus',
    name: 'Asparagus',
    fodmapRating: 'high',
    fodmapTypes: ['fructans', 'fructose'],
    safeServing: 'None established',
    notes: 'High in fructose and fructans. Avoid during elimination.',
    alternatives: ['green-beans', 'zucchini'],
  },
  {
    id: 'mushroom-button',
    name: 'Button Mushroom',
    aliases: ['white mushroom', 'cremini', 'portobello'],
    fodmapRating: 'high',
    fodmapTypes: ['polyols-mannitol'],
    safeServing: 'None - avoid',
    notes: 'All common mushrooms (button, cremini, portobello) are high FODMAP.',
    alternatives: ['oyster mushroom'],
  },
];

export function getFoodContext(): string {
  const sections = {
    low: foodDatabase.filter((f) => f.fodmapRating === 'low'),
    moderate: foodDatabase.filter((f) => f.fodmapRating === 'moderate'),
    high: foodDatabase.filter((f) => f.fodmapRating === 'high'),
  };

  let context = '';

  context += '### LOW FODMAP (Generally Safe)\n';
  for (const food of sections.low) {
    context += `- **${food.name}**${food.aliases ? ` (${food.aliases.join(', ')})` : ''}: ${food.notes}`;
    if (food.safeServing) context += ` Safe: ${food.safeServing}.`;
    context += '\n';
  }

  context += '\n### MODERATE FODMAP (Portion Control)\n';
  for (const food of sections.moderate) {
    context += `- **${food.name}**${food.aliases ? ` (${food.aliases.join(', ')})` : ''}: ${food.notes}`;
    if (food.safeServing) context += ` Safe: ${food.safeServing}.`;
    if (food.alternatives) context += ` Try: ${food.alternatives.join(', ')}.`;
    context += '\n';
  }

  context += '\n### HIGH FODMAP (Avoid)\n';
  for (const food of sections.high) {
    context += `- **${food.name}**${food.aliases ? ` (${food.aliases.join(', ')})` : ''}: ${food.notes}`;
    if (food.alternatives) context += ` Alternatives: ${food.alternatives.join(', ')}.`;
    context += '\n';
  }

  return context;
}
