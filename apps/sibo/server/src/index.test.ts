import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app,
  buildSystemPrompt,
  parseDataUrl,
  convertToAnthropicMessages,
  detectPreferenceInResponse,
  UserPreferences,
  ChatMessage,
} from './index.js';

describe('Server', () => {
  describe('parseDataUrl', () => {
    it('should parse valid base64 data URL', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = parseDataUrl(dataUrl);

      expect(result).not.toBeNull();
      expect(result?.mediaType).toBe('image/png');
      expect(result?.data).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    });

    it('should parse JPEG data URL', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
      const result = parseDataUrl(dataUrl);

      expect(result).not.toBeNull();
      expect(result?.mediaType).toBe('image/jpeg');
      expect(result?.data).toBe('/9j/4AAQSkZJRgABAQ==');
    });

    it('should return null for invalid data URL', () => {
      expect(parseDataUrl('not a data url')).toBeNull();
      expect(parseDataUrl('data:image/png')).toBeNull();
      expect(parseDataUrl('')).toBeNull();
    });
  });

  describe('detectPreferenceInResponse', () => {
    describe('tolerance detection', () => {
      it('should detect "I can eat X fine" pattern', () => {
        const result = detectPreferenceInResponse('I can eat dairy fine', '');
        expect(result).toEqual({ type: 'tolerance', items: ['dairy'] });
      });

      it('should detect "I can tolerate X" pattern', () => {
        const result = detectPreferenceInResponse('I can tolerate lactose well', '');
        expect(result).toEqual({ type: 'tolerance', items: ['lactose'] });
      });

      it('should detect "X is fine for me" pattern', () => {
        const result = detectPreferenceInResponse('Milk is fine for me', '');
        expect(result).toEqual({ type: 'tolerance', items: ['milk'] });
      });

      it('should detect "I\'m okay with X" pattern', () => {
        const result = detectPreferenceInResponse("I'm okay with cheese", '');
        expect(result).toEqual({ type: 'tolerance', items: ['cheese'] });
      });

      it('should detect "X doesn\'t bother me" pattern', () => {
        const result = detectPreferenceInResponse("Garlic doesn't bother me", '');
        expect(result).toEqual({ type: 'tolerance', items: ['garlic'] });
      });

      it('should detect multiple items separated by "and"', () => {
        const result = detectPreferenceInResponse('I can eat dairy and cheese fine', '');
        expect(result).toEqual({ type: 'tolerance', items: ['dairy', 'cheese'] });
      });

      it('should detect multiple items separated by comma', () => {
        const result = detectPreferenceInResponse('I can eat milk, yogurt fine', '');
        expect(result).toEqual({ type: 'tolerance', items: ['milk', 'yogurt'] });
      });
    });

    describe('sensitivity detection', () => {
      it('should detect "I can\'t eat X" pattern', () => {
        const result = detectPreferenceInResponse("I can't eat onions", '');
        expect(result).toEqual({ type: 'sensitivity', items: ['onions'] });
      });

      it('should detect "X bothers me" pattern', () => {
        const result = detectPreferenceInResponse('Garlic bothers me', '');
        expect(result).toEqual({ type: 'sensitivity', items: ['garlic'] });
      });

      it('should detect "I\'m sensitive to X" pattern', () => {
        const result = detectPreferenceInResponse("I'm sensitive to fructans", '');
        expect(result).toEqual({ type: 'sensitivity', items: ['fructans'] });
      });

      it('should detect "X makes me sick" pattern', () => {
        const result = detectPreferenceInResponse('Onions make me sick', '');
        expect(result).toEqual({ type: 'sensitivity', items: ['onions'] });
      });

      it('should detect "I react to X" pattern', () => {
        const result = detectPreferenceInResponse('I react badly to wheat', '');
        expect(result).toEqual({ type: 'sensitivity', items: ['wheat'] });
      });

      it('should detect "I have a problem with X" pattern', () => {
        const result = detectPreferenceInResponse('I have a problem with beans', '');
        expect(result).toEqual({ type: 'sensitivity', items: ['beans'] });
      });
    });

    it('should return null when no preference is detected', () => {
      expect(detectPreferenceInResponse('Is apple safe to eat?', '')).toBeNull();
      expect(detectPreferenceInResponse('Tell me about bananas', '')).toBeNull();
      expect(detectPreferenceInResponse('What foods are low FODMAP?', '')).toBeNull();
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build basic prompt without preferences', () => {
      const preferences: UserPreferences = {
        tolerances: { foods: [], fodmapTypes: [], categories: [] },
        sensitivities: { foods: [], fodmapTypes: [], categories: [] },
      };

      const prompt = buildSystemPrompt(preferences);

      expect(prompt).toContain('SIBO');
      expect(prompt).toContain('FODMAP');
      expect(prompt).not.toContain('User CAN TOLERATE');
      expect(prompt).not.toContain('User is SENSITIVE TO');
    });

    it('should include tolerances in prompt', () => {
      const preferences: UserPreferences = {
        tolerances: { foods: ['dairy', 'cheese'], fodmapTypes: ['lactose'], categories: [] },
        sensitivities: { foods: [], fodmapTypes: [], categories: [] },
      };

      const prompt = buildSystemPrompt(preferences);

      expect(prompt).toContain('User CAN TOLERATE');
      expect(prompt).toContain('dairy');
      expect(prompt).toContain('cheese');
      expect(prompt).toContain('lactose');
    });

    it('should include sensitivities in prompt', () => {
      const preferences: UserPreferences = {
        tolerances: { foods: [], fodmapTypes: [], categories: [] },
        sensitivities: { foods: ['garlic', 'onion'], fodmapTypes: ['fructans'], categories: [] },
      };

      const prompt = buildSystemPrompt(preferences);

      expect(prompt).toContain('User is SENSITIVE TO');
      expect(prompt).toContain('garlic');
      expect(prompt).toContain('onion');
      expect(prompt).toContain('fructans');
    });

    it('should include both tolerances and sensitivities', () => {
      const preferences: UserPreferences = {
        tolerances: { foods: ['dairy'], fodmapTypes: [], categories: [] },
        sensitivities: { foods: ['garlic'], fodmapTypes: [], categories: [] },
      };

      const prompt = buildSystemPrompt(preferences);

      expect(prompt).toContain('User CAN TOLERATE');
      expect(prompt).toContain('dairy');
      expect(prompt).toContain('User is SENSITIVE TO');
      expect(prompt).toContain('garlic');
    });
  });

  describe('convertToAnthropicMessages', () => {
    it('should convert simple text messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = convertToAnthropicMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should convert message with image', () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is this?',
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        },
      ];

      const result = convertToAnthropicMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(Array.isArray(result[0].content)).toBe(true);

      const content = result[0].content as Array<{ type: string }>;
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('image');
      expect(content[1].type).toBe('text');
    });

    it('should handle image-only message without text', () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: '',
          image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        },
      ];

      const result = convertToAnthropicMessages(messages);

      expect(result).toHaveLength(1);
      const content = result[0].content as Array<{ type: string }>;
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('image');
    });

    it('should handle invalid image data gracefully', () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: 'What is this?',
          image: 'not-a-valid-data-url',
        },
      ];

      const result = convertToAnthropicMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ role: 'user', content: 'What is this?' });
    });
  });

  describe('API Endpoints', () => {
    describe('GET /api/health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
        expect(typeof response.body.foods).toBe('number');
      });
    });

    describe('GET /api/foods', () => {
      it('should return food database', async () => {
        const response = await request(app).get('/api/foods');

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        // Check food structure
        const food = response.body[0];
        expect(food).toHaveProperty('id');
        expect(food).toHaveProperty('name');
        expect(food).toHaveProperty('fodmapRating');
        expect(food).toHaveProperty('fodmapTypes');
        expect(food).toHaveProperty('notes');
      });
    });

    describe('POST /api/chat', () => {
      it('should return 400 for missing messages', async () => {
        const response = await request(app)
          .post('/api/chat')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Messages array is required');
      });

      it('should return 400 for invalid messages format', async () => {
        const response = await request(app)
          .post('/api/chat')
          .send({ messages: 'not an array' });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Messages array is required');
      });

      // Note: Full chat endpoint testing would require mocking the Anthropic client
      // which is beyond unit testing scope - integration tests would cover this
    });
  });
});
