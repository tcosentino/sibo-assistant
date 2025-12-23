import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ImageBlockParam,
  TextBlockParam,
  TextBlock,
} from '@anthropic-ai/sdk/resources/messages';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { foodDatabase, getFoodContext } from './foods.js';
import crypto from 'crypto';
import {
  getOrCreateUser,
  getUserPreferences,
  saveUserPreferences,
  getUserConversations,
  getConversationMessages,
  createConversation,
  addMessage,
  deleteConversation,
  getUserMemories,
  addUserMemory,
  userOps,
} from './database.js';
import {
  handleGoogleSignIn,
  authMiddleware,
  optionalAuthMiddleware,
  type AuthenticatedRequest,
} from './auth.js';

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

// ============================================================================
// CACHING LAYER - Optimizations to reduce API costs and latency
// ============================================================================

// Response cache for identical queries (TTL: 5 minutes)
interface CachedResponse {
  message: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
  timestamp: number;
}

const responseCache = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Maximum cached responses

// Generate cache key from message and preferences
export function generateCacheKey(
  lastMessage: string,
  preferences: UserPreferences,
  hasImage: boolean
): string {
  // Don't cache image queries - they're unique
  if (hasImage) return '';

  // Normalize message for cache key (lowercase, trimmed)
  const normalizedMessage = lastMessage.toLowerCase().trim();

  // Create key from message + preferences hash
  const preferencesHash = crypto
    .createHash('md5')
    .update(JSON.stringify(preferences))
    .digest('hex')
    .slice(0, 8);

  return `${normalizedMessage}:${preferencesHash}`;
}

// Get cached response if valid
export function getCachedResponse(key: string): CachedResponse | null {
  if (!key) return null;

  const cached = responseCache.get(key);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }

  return cached;
}

// Store response in cache
export function setCachedResponse(key: string, response: CachedResponse): void {
  if (!key) return;

  // Evict oldest entries if cache is full
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }

  responseCache.set(key, { ...response, timestamp: Date.now() });
}

// Clear expired cache entries (called periodically)
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      responseCache.delete(key);
    }
  }
}

// Clear all cached responses (useful for testing)
export function clearResponseCache(): void {
  responseCache.clear();
}

// Run cache cleanup every minute
setInterval(cleanupCache, 60 * 1000);

// ============================================================================
// STATIC SYSTEM PROMPT - Cached at module load for Anthropic prompt caching
// ============================================================================

// Pre-compute the static base system prompt (without user preferences)
// This enables Anthropic's prompt caching which can reduce costs by up to 90%
const BASE_SYSTEM_PROMPT = `You are a helpful SIBO (Small Intestinal Bacterial Overgrowth) diet assistant. Your role is to help users understand which foods are safe to eat during SIBO treatment, based on FODMAP content.

## Your Knowledge Base
You have detailed information about these foods and their FODMAP ratings:
${getFoodContext()}

## Key FODMAP Types
- Fructose: Found in fruits, honey, high-fructose corn syrup
- Lactose: Found in dairy products
- Fructans: Found in wheat, garlic, onions
- Galactans (GOS): Found in legumes, beans
- Polyols (Sorbitol/Mannitol): Found in stone fruits, artificial sweeteners, some vegetables

## Response Guidelines

1. **Be concise but helpful** - Give clear, actionable advice
2. **Personalize responses** - If the user has told you about their tolerances, use that information
3. **Cite serving sizes** - Mention safe serving sizes when relevant
4. **Suggest alternatives** - For high-FODMAP foods, suggest lower-FODMAP alternatives
5. **Acknowledge uncertainty** - If you don't have info on a specific food, say so
6. **Acknowledge new preferences** - When the user tells you about a tolerance or sensitivity, always acknowledge it clearly (e.g., "Got it! I'll remember that you can tolerate dairy.") - their preferences are automatically saved

## Image Analysis
When users send images of food:
1. Identify all visible foods/ingredients in the image
2. For each food, provide its FODMAP rating and serving size guidance
3. Highlight any high-FODMAP ingredients that should be avoided
4. Suggest modifications if the dish contains problematic ingredients

## Detecting User Preferences
When users share their personal tolerances or sensitivities like:
- "I can eat dairy fine" / "Lactose doesn't bother me" → They tolerate lactose
- "Garlic makes me sick" / "I react to onions" → They're sensitive to fructans

IMPORTANT: Always respond with a clear acknowledgment like "Got it! I'll remember that [item] [works/doesn't work] for you." Their preferences are saved automatically, so you don't need to ask them to save anything.

## Formatting
- Use **bold** for food names when first mentioned
- Use bullet points for lists
- Keep responses focused and not too long`;

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

// Build user preferences section (dynamic, small, not cached by Anthropic)
export function buildPreferencesContext(preferences: UserPreferences): string {
  const hasTolerance =
    preferences.tolerances.foods.length > 0 ||
    preferences.tolerances.fodmapTypes.length > 0 ||
    preferences.tolerances.categories.length > 0;
  const hasSensitivity =
    preferences.sensitivities.foods.length > 0 ||
    preferences.sensitivities.fodmapTypes.length > 0 ||
    preferences.sensitivities.categories.length > 0;

  if (!hasTolerance && !hasSensitivity) {
    return '';
  }

  let preferencesContext = `\n\n## User's Personal Tolerances (IMPORTANT - Use this to personalize recommendations)\n`;

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

  return preferencesContext;
}

// Build full system prompt (combines cached base + dynamic preferences)
// Note: The actual caching happens via Anthropic's cache_control in the API call
export function buildSystemPrompt(preferences: UserPreferences): string {
  const preferencesContext = buildPreferencesContext(preferences);
  return BASE_SYSTEM_PROMPT + preferencesContext;
}

// Export base prompt for testing
export { BASE_SYSTEM_PROMPT };

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

    const userPreferences = preferences || {
      tolerances: { foods: [], fodmapTypes: [], categories: [] },
      sensitivities: { foods: [], fodmapTypes: [], categories: [] },
    };

    // Get the last user message for caching
    const lastUserMessage = messages[messages.length - 1];
    const hasImage = messages.some((msg) => msg.image);

    // Check response cache for identical queries (skip if conversation has multiple messages)
    const cacheKey =
      messages.length === 1
        ? generateCacheKey(lastUserMessage?.content || '', userPreferences, hasImage)
        : '';
    const cachedResponse = getCachedResponse(cacheKey);

    if (cachedResponse) {
      // Return cached response with cache hit indicator
      const detectedPreference = detectPreferenceInResponse(
        lastUserMessage?.content || '',
        cachedResponse.message
      );

      return res.json({
        message: cachedResponse.message,
        detectedPreference,
        usage: {
          ...cachedResponse.usage,
          cache_hit: true, // Indicate this was served from local cache
        },
      });
    }

    // Build system prompt with preferences
    const preferencesContext = buildPreferencesContext(userPreferences);

    // Convert messages to Anthropic format (handles images)
    const anthropicMessages = convertToAnthropicMessages(messages);

    // Use Anthropic's prompt caching by sending system as array with cache_control
    // The base prompt is static and will be cached by Anthropic for up to 5 minutes
    // This can reduce costs by up to 90% on the cached portion
    const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> =
      [
        {
          type: 'text' as const,
          text: BASE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // Mark for Anthropic prompt caching
        },
      ];

    // Add preferences as a separate block (not cached since it varies per user)
    if (preferencesContext) {
      systemBlocks.push({
        type: 'text' as const,
        text: preferencesContext,
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemBlocks,
      messages: anthropicMessages,
      metadata: userId ? { user_id: userId } : undefined,
    });

    // Extract text content from response
    const textContent = response.content.find((block): block is TextBlock => block.type === 'text');
    const assistantMessage = textContent?.text || '';

    // Check if Claude detected a new preference in the conversation
    const detectedPreference = detectPreferenceInResponse(
      lastUserMessage?.content || '',
      assistantMessage
    );

    // Cache the response for future identical queries
    if (cacheKey && assistantMessage) {
      setCachedResponse(cacheKey, {
        message: assistantMessage,
        usage: response.usage,
        timestamp: Date.now(),
      });
    }

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

// ============================================================================
// Authentication Routes
// ============================================================================

// Google Sign-In
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    const result = await handleGoogleSignIn(credential);

    if ('error' in result) {
      return res.status(401).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = userOps.findById.get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================================================
// Preferences Routes (Authenticated)
// ============================================================================

// Get user preferences
app.get('/api/preferences', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const preferences = getUserPreferences(req.user.id);
    res.json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Save user preferences
app.post('/api/preferences', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({ error: 'Preferences are required' });
    }

    saveUserPreferences(req.user.id, preferences);
    res.json({ success: true });
  } catch (error) {
    console.error('Save preferences error:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// ============================================================================
// Conversation/Chat History Routes (Authenticated)
// ============================================================================

// Get all conversations for user
app.get('/api/conversations', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversations = getUserConversations(req.user.id);
    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Create a new conversation
app.post('/api/conversations', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title } = req.body;
    const conversation = createConversation(req.user.id, title || null);
    res.json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a conversation
app.get('/api/conversations/:id/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversationId = parseInt(req.params.id, 10);
    const messages = getConversationMessages(conversationId);
    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Add a message to a conversation
app.post('/api/conversations/:id/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversationId = parseInt(req.params.id, 10);
    const { role, content, imageUrl } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    addMessage(conversationId, role, content, imageUrl || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a conversation
app.delete('/api/conversations/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversationId = parseInt(req.params.id, 10);
    deleteConversation(conversationId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ============================================================================
// Memory Routes (Authenticated) - For long-term user facts
// ============================================================================

// Get user memories
app.get('/api/memories', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const memories = getUserMemories(req.user.id);
    res.json({ memories });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to get memories' });
  }
});

// Add a memory
app.post('/api/memories', authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { memoryType, content, source, confidence } = req.body;

    if (!memoryType || !content) {
      return res.status(400).json({ error: 'Memory type and content are required' });
    }

    addUserMemory(req.user.id, memoryType, content, source || null, confidence || 1.0);
    res.json({ success: true });
  } catch (error) {
    console.error('Add memory error:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
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
