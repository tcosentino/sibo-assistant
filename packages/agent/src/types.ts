import type { Tool, MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: Tool['input_schema'];
  handler: (input: TInput) => Promise<ToolResult> | ToolResult;
}

export interface ToolResult {
  result: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  model?: string;
  maxTokens?: number;
  systemPrompt: string;
  tools: ToolDefinition[];
  temperature?: number;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  userId?: number;
  conversationId?: number;
}

export interface ChatResponse {
  message: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
}

// Re-export useful types from Anthropic SDK
export type { Tool, MessageParam, ContentBlock };
