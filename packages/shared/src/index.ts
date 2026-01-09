// Shared types and utilities for the monorepo

// ============================================================================
// User & Auth Types
// ============================================================================

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface JWTPayload {
  userId: number;
  googleId: string;
  email: string;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Conversation Types (shared across chat-based apps)
// ============================================================================

export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Memory Types (for AI personalization)
// ============================================================================

export interface Memory {
  id: number;
  type: string;
  content: string;
  confidence: number;
  source: string;
  created_at: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
