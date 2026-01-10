import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam, ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import type { AgentConfig, ChatMessage, ToolCall, ToolResult, ToolDefinition } from './types.js';
import { ToolRegistry, toAnthropicTools } from './tools.js';

// ============================================================================
// Agent Class
// ============================================================================

export interface AgentOptions {
  apiKey?: string;
  baseURL?: string;
}

export class Agent {
  private client: Anthropic;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;

  constructor(config: AgentConfig, options: AgentOptions = {}) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.config = {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 1,
      ...config,
    };
    this.toolRegistry = new ToolRegistry();
    this.toolRegistry.registerAll(config.tools);
  }

  /**
   * Send a message to the agent and get a response
   */
  async chat(
    messages: ChatMessage[],
    options: {
      onToolCall?: (toolCall: ToolCall) => void;
    } = {}
  ): Promise<{ message: string; toolCalls: ToolCall[] }> {
    const anthropicMessages: MessageParam[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const toolCalls: ToolCall[] = [];
    let finalMessage = '';

    // Agentic loop: keep calling until we get a final response
    while (true) {
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        system: this.config.systemPrompt,
        messages: anthropicMessages,
        tools: toAnthropicTools(this.config.tools),
        temperature: this.config.temperature,
      });

      // Process the response content
      const toolUseBlocks: Array<{
        type: 'tool_use';
        id: string;
        name: string;
        input: Record<string, unknown>;
      }> = [];
      const textBlocks: string[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textBlocks.push(block.text);
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block as {
            type: 'tool_use';
            id: string;
            name: string;
            input: Record<string, unknown>;
          });
        }
      }

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        finalMessage = textBlocks.join('\n');
        break;
      }

      // Process tool calls
      const toolResults: Array<{
        type: 'tool_result';
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolUse of toolUseBlocks) {
        const result = await this.toolRegistry.execute(
          toolUse.name,
          toolUse.input
        );

        const toolCall: ToolCall = {
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
          result: result.result,
        };
        toolCalls.push(toolCall);
        options.onToolCall?.(toolCall);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.result,
        });
      }

      // Add assistant message with tool use
      anthropicMessages.push({
        role: 'assistant',
        content: response.content as ContentBlock[],
      });

      // Add tool results
      anthropicMessages.push({
        role: 'user',
        content: toolResults,
      });
    }

    return { message: finalMessage, toolCalls };
  }

  /**
   * Get the tool registry for manual tool management
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get the underlying Anthropic client
   */
  getClient(): Anthropic {
    return this.client;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAgent(config: AgentConfig, options?: AgentOptions): Agent {
  return new Agent(config, options);
}
