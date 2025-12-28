import { tool, Agent } from '@openai/agents';
import { z } from 'zod';
import type { RunContext } from '@openai/agents';

/**
 * Built-in tools available to all agents
 * 
 * This file demonstrates two patterns for creating tools:
 * 
 * 1. Simple function-based tools using tool()
 *    - Best for: Simple operations (math, API calls, data fetching)
 *    - Parameters: Zod schema for validation
 *    - Features: needsApproval, errorFunction, RunContext
 * 
 * 2. Agent-based tools using Agent.asTool()
 *    - Best for: Complex operations that need LLM reasoning
 *    - Supports streaming events from nested agent execution
 *    - Can chain multiple agents together
 *    - Use onStream for catch-all events or on() for selective subscription
 * 
 * Streaming events from agent tools (Agent SDK v0.3.7+):
 * - onStream: Catch-all callback for all streaming events
 * - on(eventName): Subscribe to specific event types ('*', 'run_item_stream_event', etc.)
 * - Event types match RunStreamEvent['type']
 * 
 * TODO: Add more built-in tools:
 * - webSearch: Search the web using a search API (Brave, Serper, etc.)
 * - sendEmail: Send emails via SendGrid or similar
 * - createCalendarEvent: Create calendar events via Google Calendar API
 * - fetchUrl: Fetch content from a URL
 */

// ============================================================================
// SIMPLE FUNCTION-BASED TOOLS
// ============================================================================

/**
 * Example tool that returns the current time
 * 
 * Demonstrates basic tool structure without streaming (most common case)
 * 
 * Note: In strict mode, avoid .optional() and .nullable().
 * Either require the parameter or use an empty schema z.object({}).
 */
export const currentTime = tool({
  name: 'currentTime',
  description: 'Get the current date and time in the specified timezone',
  parameters: z.object({
    timezone: z.string().describe('Timezone (e.g., "America/New_York", "UTC", "Europe/London")'),
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const timeString = timezone && timezone !== 'UTC'
      ? now.toLocaleString('en-US', { timeZone: timezone })
      : now.toISOString();
    
    return {
      timestamp: now.toISOString(),
      formatted: timeString,
      timezone: timezone || 'UTC',
    };
  },
});

/**
 * Calculator tool - Simple example without streaming
 */
export const calculator = tool({
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The arithmetic operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ operation, a, b }) => {
    let result: number;
    
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
    }
    
    return {
      operation,
      a,
      b,
      result,
    };
  },
});

/**
 * Weather lookup tool - Demonstrates basic async execution
 * 
 * In production, this would call a real weather API (OpenWeather, Weather.gov, etc.)
 */
export const weatherLookup = tool({
  name: 'weatherLookup',
  description: 'Get current weather for a location. Returns temperature, conditions, and forecast.',
  parameters: z.object({
    location: z.string().describe('City name or "latitude,longitude"'),
    units: z.enum(['celsius', 'fahrenheit']).describe('Temperature units'),
  }),
  execute: async ({ location, units }) => {
    console.log(`[weatherLookup] Fetching weather for ${location}`);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock weather data (in production, call a real weather API)
    return {
      location,
      temperature: units === 'celsius' ? 22 : 72,
      units,
      condition: 'Partly cloudy',
      humidity: 65,
      windSpeed: 15,
      forecast: [
        { day: 'Today', high: 24, low: 18, condition: 'Sunny' },
        { day: 'Tomorrow', high: 23, low: 17, condition: 'Cloudy' },
        { day: 'Day 3', high: 21, low: 16, condition: 'Rain' },
      ],
    };
  },
});

/**
 * Tool with empty parameters - For tools that don't need input
 * 
 * RunContext provides:
 * - context.agent: The agent instance
 * - context.runId: Unique ID for this run
 * - context.state: Run state (messages, tool calls, etc.)
 * - Custom context data passed to the agent
 * 
 * Note: In strict mode (default), all parameters in the schema must be required.
 * For tools without parameters, use z.object({}).
 */
export const getUserInfo = tool({
  name: 'getUserInfo',
  description: 'Get information about the current user from the context',
  parameters: z.object({}), // Empty schema for tools that don't require parameters
  execute: async (_input, context?: RunContext) => {
    console.log('[getUserInfo] Accessing user context');
    
    // In a real app, you'd pass user data through RunContext
    // Example: await run(agent, message, { context: { userId: '123', userEmail: 'user@example.com' } })
    
    // Mock user data
    const userData = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'premium',
      joined: '2024-01-15',
    };
    
    return userData;
  },
});

/**
 * Tool with approval requirement - For sensitive operations
 * 
 * When needsApproval is true, the tool execution will pause and return
 * an interruption that must be approved/rejected before continuing.
 * 
 * Use this for:
 * - Destructive operations (delete, archive)
 * - Financial transactions
 * - Data modifications
 * - External API calls that cost money
 */
export const deleteUserData = tool({
  name: 'deleteUserData',
  description: 'Delete user data. Requires approval before execution.',
  parameters: z.object({
    userId: z.string().describe('ID of the user whose data to delete'),
    dataType: z.enum(['profile', 'messages', 'all']).describe('Type of data to delete'),
  }),
  // This tool requires human approval before execution
  needsApproval: true,
  execute: async ({ userId, dataType }) => {
    console.log(`[deleteUserData] Deleting ${dataType} for user ${userId}`);
    
    // Simulate deletion operation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      userId,
      dataType,
      deletedAt: new Date().toISOString(),
      message: `Successfully deleted ${dataType} for user ${userId}`,
    };
  },
});

/**
 * Tool with custom error handling - Provides fallback behavior
 * 
 * errorFunction allows you to:
 * - Return graceful error messages to the model
 * - Provide fallback values
 * - Log errors for debugging
 * - Transform errors into actionable feedback
 * 
 * Note: In strict mode, Zod validators like .url(), .email(), etc. are not supported.
 * Use plain .string() and describe the expected format in the description.
 */
export const fetchExternalData = tool({
  name: 'fetchExternalData',
  description: 'Fetch data from an external API. Falls back gracefully on errors.',
  parameters: z.object({
    endpoint: z.string().describe('API endpoint URL (e.g., "https://api.example.com/data")'),
  }),
  execute: async ({ endpoint }) => {
    console.log(`[fetchExternalData] Fetching from ${endpoint}`);
    
    // Simulate API call that might fail
    const shouldFail = Math.random() < 0.3; // 30% failure rate for demo
    
    if (shouldFail) {
      throw new Error('API request timeout');
    }
    
    return {
      success: true,
      data: { example: 'data' },
      timestamp: new Date().toISOString(),
    };
  },
  // Custom error handling - provides a friendly message to the model
  errorFunction: (context, error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fetchExternalData] Error:', errorMessage);
    
    // Return a message that the model can work with
    return `Unable to fetch data from the external API: ${errorMessage}. Please try again later or use cached data.`;
  },
});

// ============================================================================
// AGENT-BASED TOOLS (WITH STREAMING SUPPORT)
// ============================================================================

/**
 * Example: Math reasoning agent that can handle complex math problems
 * 
 * This demonstrates the agent-as-tool pattern with streaming events.
 * The agent can reason about complex problems and stream its thinking process.
 */
const mathReasoningAgent = new Agent({
  name: 'Math Reasoning Agent',
  instructions: `You are a math expert who breaks down complex problems step by step.
For simple calculations, use the calculator tool. For word problems, explain your reasoning clearly.`,
  tools: [calculator], // Agent can use other tools!
});

/**
 * Convert the math agent to a tool with streaming support
 * 
 * Streaming events allow the parent agent to see what the nested agent is doing:
 * - run_item_stream_event: Structured events (tool calls, messages)
 * - raw_model_stream_event: Raw tokens from the LLM
 * - agent_updated_stream_event: Agent state changes
 * 
 * This is useful for:
 * - Forwarding nested agent events to the client via SSE
 * - Debugging complex agent interactions
 * - Analytics and monitoring
 * - Showing real-time progress to users
 */
export const mathReasoningTool = mathReasoningAgent.asTool({
  toolName: 'math_reasoning',
  toolDescription: 'Solve complex math problems with step-by-step reasoning. Use this for word problems or multi-step calculations.',
  
  // onStream: Catch-all handler for all streaming events
  onStream: (event) => {
    // Log all events for debugging (remove in production or make conditional)
    console.log(`[mathReasoningTool] ${event.event.type}`, {
      agent: event.agent.name,
      toolCall: event.toolCall?.id,
      eventType: event.event.type,
    });
    
    // You can also:
    // 1. Forward these events to the client via SSE
    // 2. Send to analytics/telemetry service
    // 3. Store in logs for debugging
    // 4. Update UI with real-time progress
    
    // Example: Forward specific events to client (pseudo-code)
    // if (event.event.type === 'run_item_stream_event') {
    //   const item = event.event.item;
    //   if (item.type === 'message') {
    //     sendSSE({ type: 'nested_agent_message', content: item.content });
    //   }
    // }
  },
});

// You can also attach selective event handlers using on():
mathReasoningTool.on('run_item_stream_event', (event) => {
  // Handle specific event types for fine-grained control
  if (event.event.type === 'run_item_stream_event') {
    const itemEvent = event.event;
    
    // Check the event name to understand what happened
    if (itemEvent.name === 'message_output_created') {
      console.log('[mathReasoningTool] Message created:', itemEvent.item);
    } else if (itemEvent.name === 'tool_called') {
      console.log('[mathReasoningTool] Tool called:', itemEvent.item);
    } else if (itemEvent.name === 'tool_output') {
      console.log('[mathReasoningTool] Tool output:', itemEvent.item);
    }
  }
});

// Use '*' to subscribe to all events (alternative to onStream)
mathReasoningTool.on('*', (event) => {
  // This receives all event types
  console.log('[mathReasoningTool] All events:', event.event.type);
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * All built-in tools
 * 
 * This array includes various tool patterns:
 * 
 * Simple function-based tools:
 * - currentTime: Simple synchronous operation
 * - calculator: Basic computation
 * - weatherLookup: Async API call with required parameters
 * - getUserInfo: Empty parameters (no input needed)
 * - deleteUserData: Requires approval (needsApproval: true)
 * - fetchExternalData: Custom error handling with errorFunction
 * 
 * Agent-based tools with streaming:
 * - mathReasoningTool: Agent-as-tool with onStream and on() event handlers
 * 
 * Important notes about parameters in strict mode (default):
 * - All parameters in z.object() must be required (no .optional())
 * - If you need optional fields, make them required and provide defaults in execute
 * - For tools without parameters, use z.object({})
 * - The model will be forced to provide all required parameters
 * 
 * Note: Agent-based tools will automatically stream events if handlers are attached.
 * If no handlers are present, they run in non-streaming mode.
 */
export const builtinTools = [
  currentTime,
  calculator,
  weatherLookup,
  getUserInfo,
  deleteUserData,
  fetchExternalData,
  mathReasoningTool, // Agent-based tool with streaming
];

