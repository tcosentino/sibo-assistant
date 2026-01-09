// @monorepo/agent - Shared Claude agent functionality

// Core agent class
export { Agent, createAgent, type AgentOptions } from './agent.js';

// Tool utilities
export {
  defineTool,
  toAnthropicTools,
  ToolRegistry,
  inputSchemas,
} from './tools.js';

// Types
export type {
  ToolDefinition,
  ToolResult,
  AgentConfig,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ToolCall,
  Tool,
  MessageParam,
  ContentBlock,
} from './types.js';
