import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import { foodDatabase, getFoodContext } from './foods.js';

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Anthropic client with Helicone proxy
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://anthropic.helicone.ai',
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

interface UserPreferences {
  tolerances: {
    foods: string[];
    fodmapTypes: string[];
    categories: string[];
  };
  sensitivities: {
    foods: string[];
    fodmapTypes: string[];
    categories: string[];
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  preferences: UserPreferences;
  userId?: string;
}

function buildSystemPrompt(preferences: UserPreferences): string {
  const foodContext = getFoodContext();

  let preferencesContext = '';
  const hasTolerance =
    preferences.tolerances.foods.length > 0 ||
    preferences.tolerances.fodmapTypes.length > 0 ||
    preferences.tolerances.categories.length > 0;
  const hasSensitivity =
    preferences.sensitivities.foods.length > 0 ||
    preferences.sensitivities.fodmapTypes.length > 0 ||
    preferences.sensitivities.categories.length > 0;

  if (hasTolerance || hasSensitivity) {
    preferencesContext = `\n\n## User's Personal Tolerances (IMPORTANT - Use this to personalize recommendations)\n`;

    if (hasTolerance) {
      const items = [
        ...preferences.tolerances.foods,
        ...preferences.tolerances.fodmapTypes,
        ...preferences.tolerances.categories,
      ];
      preferencesContext += `- User CAN TOLERATE: ${items.join(', ')}\n`;
      preferencesContext += `  When these foods/types come up, acknowledge that they work for this specific user even if generally problematic.\n`;
    }

    if (hasSensitivity) {
      const items = [
        ...preferences.sensitivities.foods,
        ...preferences.sensitivities.fodmapTypes,
        ...preferences.sensitivities.categories,
      ];
      preferencesContext += `- User is SENSITIVE TO: ${items.join(', ')}\n`;
      preferencesContext += `  Warn about these even if they're generally considered safe.\n`;
    }
  }

  return `You are a helpful SIBO (Small Intestinal Bacterial Overgrowth) diet assistant. Your role is to help users understand which foods are safe to eat during SIBO treatment, based on FODMAP content.

## Your Knowledge Base
You have detailed information about these foods and their FODMAP ratings:
${foodContext}

## Key FODMAP Types
- Fructose: Found in fruits, honey, high-fructose corn syrup
- Lactose: Found in dairy products
- Fructans: Found in wheat, garlic, onions
- Galactans (GOS): Found in legumes, beans
- Polyols (Sorbitol/Mannitol): Found in stone fruits, artificial sweeteners, some vegetables
${preferencesContext}
## Response Guidelines

1. **Be concise but helpful** - Give clear, actionable advice
2. **Personalize responses** - If the user has told you about their tolerances, use that information
3. **Cite serving sizes** - Mention safe serving sizes when relevant
4. **Suggest alternatives** - For high-FODMAP foods, suggest lower-FODMAP alternatives
5. **Acknowledge uncertainty** - If you don't have info on a specific food, say so
6. **Remember new preferences** - If the user tells you about a new tolerance or sensitivity, acknowledge it and ask them to save it

## Detecting User Preferences
When users say things like:
- "I can eat dairy fine" / "Lactose doesn't bother me" → They tolerate lactose
- "Garlic makes me sick" / "I react to onions" → They're sensitive to fructans
Acknowledge these and suggest they use the save button in the app to remember this preference.

## Formatting
- Use **bold** for food names when first mentioned
- Use bullet points for lists
- Keep responses focused and not too long`;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, preferences, userId } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const systemPrompt = buildSystemPrompt(preferences || {
      tolerances: { foods: [], fodmapTypes: [], categories: [] },
      sensitivities: { foods: [], fodmapTypes: [], categories: [] },
    });

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
      metadata: userId ? { user_id: userId } : undefined,
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    const assistantMessage = textContent?.type === 'text' ? textContent.text : '';

    // Check if Claude detected a new preference in the conversation
    const detectedPreference = detectPreferenceInResponse(
      messages[messages.length - 1]?.content || '',
      assistantMessage
    );

    res.json({
      message: assistantMessage,
      detectedPreference,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Detect if the user expressed a preference in their message
function detectPreferenceInResponse(
  userMessage: string,
  _assistantResponse: string
): { type: 'tolerance' | 'sensitivity'; items: string[] } | null {
  const lowerMessage = userMessage.toLowerCase();

  // Tolerance patterns
  const tolerancePatterns = [
    /i (?:can|could) (?:eat|have|handle|tolerate|digest) (.+?)(?:\s+(?:fine|ok|okay|well|no problem|without issues?))?(?:\.|$)/i,
    /(.+?) (?:is|are) (?:fine|ok|okay) (?:for me|with me)/i,
    /i(?:'m| am) (?:fine|ok|okay|good) with (.+)/i,
    /i don'?t have (?:a )?(?:problem|issue|trouble) with (.+)/i,
    /(.+?) (?:doesn'?t|don'?t|does not|do not) (?:bother|affect|upset) me/i,
    /i tolerate (.+?) (?:well|fine|ok)/i,
  ];

  // Sensitivity patterns
  const sensitivityPatterns = [
    /i (?:can'?t|cannot|couldn'?t) (?:eat|have|handle|tolerate|digest) (.+)/i,
    /(.+?) (?:bothers?|upsets?|affects?) me/i,
    /i(?:'m| am) sensitive to (.+)/i,
    /i have (?:a )?(?:problem|issue|trouble) with (.+)/i,
    /(.+?) (?:makes?|make) me (?:sick|bloated|uncomfortable)/i,
    /i react (?:badly )?to (.+)/i,
  ];

  for (const pattern of tolerancePatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      const items = match[1]
        .split(/,|and/)
        .map((s) => s.trim().replace(/[.!?]$/, ''))
        .filter((s) => s.length > 0);
      return { type: 'tolerance', items };
    }
  }

  for (const pattern of sensitivityPatterns) {
    const match = lowerMessage.match(pattern);
    if (match) {
      const items = match[1]
        .split(/,|and/)
        .map((s) => s.trim().replace(/[.!?]$/, ''))
        .filter((s) => s.length > 0);
      return { type: 'sensitivity', items };
    }
  }

  return null;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', foods: foodDatabase.length });
});

// Get food database
app.get('/api/foods', (_req, res) => {
  res.json(foodDatabase);
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Helicone integration: ${process.env.HELICONE_API_KEY ? 'enabled' : 'disabled (no API key)'}`);
});
