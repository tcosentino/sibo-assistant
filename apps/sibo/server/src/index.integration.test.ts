import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';

// Use vi.hoisted to define mock before hoisting
const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() };
});

// Mock Anthropic SDK before importing the app
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Import app after mocking
import { app, clearResponseCache } from './index.js';

// Helper to extract full system prompt from the array format
function getSystemPromptText(systemBlocks: Array<{ type: string; text: string }>): string {
  if (typeof systemBlocks === 'string') return systemBlocks;
  return systemBlocks.map((block) => block.text).join('\n');
}

describe('Chat API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearResponseCache(); // Clear cache between tests to ensure clean state
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/chat - Full Flow', () => {
    it('should process a simple food question and return response', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '**Carrots** are low FODMAP and safe for SIBO patients. You can enjoy them freely up to 75g per serving.',
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Can I eat carrots?' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Carrots');
      expect(response.body.message).toContain('low FODMAP');
      expect(response.body.usage).toBeDefined();
      expect(response.body.detectedPreference).toBeNull();

      // Verify Anthropic was called correctly
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Can I eat carrots?' }],
        })
      );

      // Verify system prompt contains expected content (now an array format)
      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).toContain('SIBO');
    });

    it('should include user preferences in system prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Based on your tolerance to lactose, dairy should be fine for you.' }],
        usage: { input_tokens: 150, output_tokens: 30 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Can I have milk?' }],
          preferences: {
            tolerances: { foods: ['milk'], fodmapTypes: ['lactose'], categories: ['dairy'] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);

      // Verify system prompt includes preferences (now an array format)
      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).toContain('User CAN TOLERATE');
      expect(systemPrompt).toContain('lactose');
      expect(systemPrompt).toContain('dairy');
    });

    it('should include sensitivity warnings in system prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Given your sensitivity to fructans, you should avoid garlic.' }],
        usage: { input_tokens: 150, output_tokens: 30 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'What about garlic?' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: ['garlic'], fodmapTypes: ['fructans'], categories: [] },
          },
        });

      expect(response.status).toBe(200);

      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).toContain('User is SENSITIVE TO');
      expect(systemPrompt).toContain('garlic');
      expect(systemPrompt).toContain('fructans');
    });

    it('should detect tolerance expression in user message', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: "That's great that you can tolerate dairy! I'll keep that in mind." }],
        usage: { input_tokens: 100, output_tokens: 40 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'I can eat dairy fine' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.detectedPreference).toEqual({
        type: 'tolerance',
        items: ['dairy'],
      });
    });

    it('should detect sensitivity expression in user message', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: "I'm sorry to hear onions bother you. Let me suggest some alternatives." }],
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Onions make me sick' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.detectedPreference).toEqual({
        type: 'sensitivity',
        items: ['onions'],
      });
    });

    it('should handle multi-turn conversation', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Yes, cucumber is also low FODMAP and safe!' }],
        usage: { input_tokens: 200, output_tokens: 30 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: 'Is carrot safe?' },
            { role: 'assistant', content: 'Yes, carrots are low FODMAP.' },
            { role: 'user', content: 'What about cucumber?' },
          ],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);

      // Verify all messages were passed
      const messages = mockCreate.mock.calls[0][0].messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Is carrot safe?');
      expect(messages[1].content).toBe('Yes, carrots are low FODMAP.');
      expect(messages[2].content).toBe('What about cucumber?');
    });

    it('should include userId in metadata when provided', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
          userId: 'user-123',
        });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { user_id: 'user-123' },
        })
      );
    });

    it('should not include metadata when userId is not provided', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello unique message for this test' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate.mock.calls[0][0].metadata).toBeUndefined();
    });
  });

  describe('POST /api/chat - Image Handling', () => {
    it('should process image with text message', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'I can see a salad with lettuce and tomatoes. Both are low FODMAP and safe!',
          },
        ],
        usage: { input_tokens: 500, output_tokens: 40 },
      });

      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            {
              role: 'user',
              content: 'Is this salad safe to eat?',
              image: base64Image,
            },
          ],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('salad');

      // Verify image was included in the message
      const messages = mockCreate.mock.calls[0][0].messages;
      expect(messages[0].content).toBeInstanceOf(Array);
      expect(messages[0].content[0].type).toBe('image');
      expect(messages[0].content[0].source.type).toBe('base64');
      expect(messages[0].content[0].source.media_type).toBe('image/png');
      expect(messages[0].content[1].type).toBe('text');
      expect(messages[0].content[1].text).toBe('Is this salad safe to eat?');
    });

    it('should process image-only message', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I see a plate of pasta.' }],
        usage: { input_tokens: 400, output_tokens: 20 },
      });

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [
            {
              role: 'user',
              content: '',
              image: base64Image,
            },
          ],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);

      // Verify only image was sent (no text block)
      const messages = mockCreate.mock.calls[0][0].messages;
      expect(messages[0].content).toHaveLength(1);
      expect(messages[0].content[0].type).toBe('image');
    });

    it('should handle JPEG images correctly', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 400, output_tokens: 20 },
      });

      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'What is this?', image: base64Image }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      const messages = mockCreate.mock.calls[0][0].messages;
      expect(messages[0].content[0].source.media_type).toBe('image/jpeg');
    });
  });

  describe('POST /api/chat - Error Handling', () => {
    it('should return 500 when Anthropic API fails', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Error test message 1 - rate limit' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to process chat request');
      expect(response.body.details).toBe('API rate limit exceeded');
    });

    it('should handle network errors gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error: connection refused'));

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Error test message 2 - network error' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(500);
      expect(response.body.details).toContain('Network error');
    });

    it('should handle empty response content gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [],
        usage: { input_tokens: 100, output_tokens: 0 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Error test message 3 - empty response' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('');
    });

    it('should handle missing preferences gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Error test message 4 - missing preferences' }],
          // preferences intentionally omitted
        });

      expect(response.status).toBe(200);

      // Should use default empty preferences (now an array format)
      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).not.toContain('User CAN TOLERATE');
      expect(systemPrompt).not.toContain('User is SENSITIVE TO');
    });
  });

  describe('POST /api/chat - Complex Preference Detection', () => {
    it('should detect multiple foods in tolerance statement', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Noted!' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'I can eat dairy and cheese fine' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.body.detectedPreference).toEqual({
        type: 'tolerance',
        items: ['dairy', 'cheese'],
      });
    });

    it('should detect comma-separated items', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Understood!' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: "I'm sensitive to garlic, onions" }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.body.detectedPreference).toEqual({
        type: 'sensitivity',
        items: ['garlic', 'onions'],
      });
    });

    it('should not detect preference in regular question', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Apples are moderate FODMAP.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Are apples safe to eat?' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      expect(response.body.detectedPreference).toBeNull();
    });
  });

  describe('System Prompt Content', () => {
    it('should include FODMAP type descriptions', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'System prompt test 1 - FODMAP types' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).toContain('Fructose');
      expect(systemPrompt).toContain('Lactose');
      expect(systemPrompt).toContain('Fructans');
      expect(systemPrompt).toContain('Galactans');
      expect(systemPrompt).toContain('Polyols');
    });

    it('should include image analysis guidelines', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'System prompt test 2 - image guidelines' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      expect(systemPrompt).toContain('Image Analysis');
      expect(systemPrompt).toContain('Identify all visible foods');
    });

    it('should include tools and common foods reference', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 100, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'System prompt test 3 - tools' }],
          preferences: {
            tolerances: { foods: [], fodmapTypes: [], categories: [] },
            sensitivities: { foods: [], fodmapTypes: [], categories: [] },
          },
        });

      const systemBlocks = mockCreate.mock.calls[0][0].system;
      const systemPrompt = getSystemPromptText(systemBlocks);
      // Should reference tools instead of full food database
      expect(systemPrompt).toContain('Tools Available');
      expect(systemPrompt).toContain('lookup_food');
      expect(systemPrompt).toContain('save_preference');
      // Should include common foods summary
      expect(systemPrompt).toContain('Quick Reference');
    });
  });

  describe('Response Caching', () => {
    it('should cache responses for identical single-message queries', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Cached response' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      });

      const preferences = {
        tolerances: { foods: [], fodmapTypes: [], categories: [] },
        sensitivities: { foods: [], fodmapTypes: [], categories: [] },
      };

      // First request - should call API
      const response1 = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Cache test message' }],
          preferences,
        });

      // Second identical request - should return cached response
      const response2 = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Cache test message' }],
          preferences,
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response2.body.message).toBe('Cached response');
      expect(response2.body.usage.cache_hit).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should not cache multi-message conversations', async () => {
      mockCreate
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Response 1' }],
          usage: { input_tokens: 100, output_tokens: 10 },
        })
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Response 2' }],
          usage: { input_tokens: 100, output_tokens: 10 },
        });

      const preferences = {
        tolerances: { foods: [], fodmapTypes: [], categories: [] },
        sensitivities: { foods: [], fodmapTypes: [], categories: [] },
      };

      // First multi-message request
      await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'First response' },
            { role: 'user', content: 'Second message' },
          ],
          preferences,
        });

      // Second identical multi-message request - should NOT use cache
      await request(app)
        .post('/api/chat')
        .send({
          messages: [
            { role: 'user', content: 'First message' },
            { role: 'assistant', content: 'First response' },
            { role: 'user', content: 'Second message' },
          ],
          preferences,
        });

      expect(mockCreate).toHaveBeenCalledTimes(2); // Called twice, no caching
    });
  });
});
