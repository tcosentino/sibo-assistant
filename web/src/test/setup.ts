import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock fetch globally for tests
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
