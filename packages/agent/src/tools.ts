import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { ToolDefinition, ToolResult } from './types.js';

// ============================================================================
// Tool Builder Utilities
// ============================================================================

/**
 * Create a tool definition from a simpler interface
 */
export function defineTool<TInput>(
  name: string,
  description: string,
  inputSchema: Tool['input_schema'],
  handler: (input: TInput) => Promise<ToolResult> | ToolResult
): ToolDefinition<TInput> {
  return {
    name,
    description,
    inputSchema,
    handler,
  };
}

/**
 * Convert tool definitions to Anthropic SDK Tool format
 */
export function toAnthropicTools(tools: ToolDefinition[]): Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<TInput>(tool: ToolDefinition<TInput>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toAnthropicTools(): Tool[] {
    return toAnthropicTools(this.getAll());
  }

  async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { result: `Unknown tool: ${name}` };
    }
    return tool.handler(input);
  }
}

// ============================================================================
// Common Input Schema Helpers
// ============================================================================

export const inputSchemas = {
  string: (description: string, required = true) => ({
    type: 'string' as const,
    description,
    ...(required ? {} : { optional: true }),
  }),

  number: (description: string, required = true) => ({
    type: 'number' as const,
    description,
    ...(required ? {} : { optional: true }),
  }),

  boolean: (description: string, required = true) => ({
    type: 'boolean' as const,
    description,
    ...(required ? {} : { optional: true }),
  }),

  enum: <T extends string>(description: string, values: T[], required = true) => ({
    type: 'string' as const,
    enum: values,
    description,
    ...(required ? {} : { optional: true }),
  }),

  array: (description: string, itemType: 'string' | 'number' = 'string', required = true) => ({
    type: 'array' as const,
    items: { type: itemType },
    description,
    ...(required ? {} : { optional: true }),
  }),
};
