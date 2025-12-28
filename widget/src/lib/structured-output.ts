/**
 * Utilities for handling structured output from agents
 * 
 * When an agent is configured with an outputSchema, it returns structured JSON
 * instead of plain text. This module provides utilities to detect and parse
 * these structured responses.
 */

/**
 * Structured response with common fields
 * Extend this interface for specific agent response types
 */
export interface StructuredResponse {
  response?: string;  // Main response text to display
  reasoning?: string; // Internal reasoning (optional)
  [key: string]: any; // Allow other fields
}

/**
 * Result of parsing a message content
 */
export interface ParsedContent {
  isStructured: boolean;
  displayText: string;
  metadata?: Record<string, any>;
  rawData?: any;
}

/**
 * Detect if content is valid JSON
 */
export function isJsonContent(content: string): boolean {
  if (!content || !content.trim()) return false;
  
  const trimmed = content.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
    return false;
  }
  
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse message content and extract display text
 * 
 * For structured responses (JSON), extracts the 'response' field if available.
 * For plain text, returns as-is.
 * 
 * @param content - Message content (plain text or JSON string)
 * @returns Parsed content with display text and metadata
 * 
 * @example
 * // Plain text
 * parseMessageContent("Hello!")
 * // => { isStructured: false, displayText: "Hello!" }
 * 
 * @example
 * // Structured with response field
 * parseMessageContent('{"response":"Hello!","reasoning":"Greeting the user"}')
 * // => {
 * //   isStructured: true,
 * //   displayText: "Hello!",
 * //   metadata: { reasoning: "Greeting the user" }
 * // }
 */
export function parseMessageContent(content: string): ParsedContent {
  if (!isJsonContent(content)) {
    // Plain text response
    return {
      isStructured: false,
      displayText: content,
    };
  }

  try {
    const data = JSON.parse(content) as StructuredResponse;

    // If it has a 'response' field, use that as display text
    if (typeof data.response === 'string') {
      const metadata: Record<string, any> = {};
      
      // Collect other fields as metadata
      Object.keys(data).forEach((key) => {
        if (key !== 'response' && data[key] !== undefined) {
          metadata[key] = data[key];
        }
      });

      return {
        isStructured: true,
        displayText: data.response,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        rawData: data,
      };
    }

    // If no 'response' field, pretty-print the JSON
    return {
      isStructured: true,
      displayText: JSON.stringify(data, null, 2),
      rawData: data,
    };
  } catch (error) {
    // If JSON parsing fails (shouldn't happen if isJsonContent passed),
    // return as plain text
    return {
      isStructured: false,
      displayText: content,
    };
  }
}

/**
 * Check if content looks like incomplete JSON (for streaming)
 * This helps avoid parsing errors during streaming
 */
export function looksLikeIncompleteJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false;
  }
  
  // Count opening and closing braces/brackets
  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/]/g) || []).length;
  
  return openBraces !== closeBraces || openBrackets !== closeBrackets;
}

