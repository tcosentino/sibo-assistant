import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { foodDatabase, getFoodContext } from './foods.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for image uploads

// Initialize Anthropic client with Helicone proxy
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://anthropic.helicone.ai',
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
  },
});

export interface UserPreferences {
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

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64 data URL
}

export interface ChatRequest {
  messages: ChatMessage[];
  preferences: UserPreferences;
  userId?: string;
}

export function buildSystemPrompt(preferences: UserPreferences): string {
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

## Image Analysis
When users send images of food:
1. Identify all visible foods/ingredients in the image
2. For each food, provide its FODMAP rating and serving size guidance
3. Highlight any high-FODMAP ingredients that should be avoided
4. Suggest modifications if the dish contains problematic ingredients

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

// Parse base64 data URL to extract media type and data
export function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mediaType: match[1],
    data: match[2],
  };
}

// Convert our message format to Anthropic's format
export function convertToAnthropicMessages(messages: ChatMessage[]): MessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'assistant') {
      return {
        role: 'assistant' as const,
        content: msg.content,
      };
    }

    // User message - may include image
    if (msg.image) {
      const parsed = parseDataUrl(msg.image);
      if (parsed) {
        const content: (ImageBlockParam | TextBlockParam)[] = [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: parsed.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: parsed.data,
            },
          },
        ];

        if (msg.content) {
          content.push({
            type: 'text' as const,
            text: msg.content,
          });
        }

        return {
          role: 'user' as const,
          content,
        };
      }
    }

    return {
      role: 'user' as const,
      content: msg.content,
    };
  });
}

// Detect if the user expressed a preference in their message
export function detectPreferenceInResponse(
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

    // Convert messages to Anthropic format (handles images)
    const anthropicMessages = convertToAnthropicMessages(messages);

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
    const lastUserMessage = messages[messages.length - 1];
    const detectedPreference = detectPreferenceInResponse(
      lastUserMessage?.content || '',
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

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', foods: foodDatabase.length });
});

// Get food database
app.get('/api/foods', (_req, res) => {
  res.json(foodDatabase);
});

// Serve static files from the public directory (production)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for any non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Only start the server if this file is run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Helicone integration: ${process.env.HELICONE_API_KEY ? 'enabled' : 'disabled (no API key)'}`);
  });
}
