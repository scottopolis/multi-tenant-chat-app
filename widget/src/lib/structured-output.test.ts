/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  isJsonContent,
  parseMessageContent,
  looksLikeIncompleteJson,
} from './structured-output';

describe('Structured Output Utils', () => {
  describe('isJsonContent', () => {
    it('should detect valid JSON objects', () => {
      expect(isJsonContent('{"response":"Hello"}')).toBe(true);
      expect(isJsonContent(' {"response":"Hello"} ')).toBe(true);
    });

    it('should detect valid JSON arrays', () => {
      expect(isJsonContent('[1, 2, 3]')).toBe(true);
      expect(isJsonContent('  [{"a": 1}]  ')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isJsonContent('Hello world')).toBe(false);
      expect(isJsonContent('123')).toBe(false);
      expect(isJsonContent('true')).toBe(false);
    });

    it('should return false for invalid JSON', () => {
      expect(isJsonContent('{invalid}')).toBe(false);
      expect(isJsonContent('{"unclosed": ')).toBe(false);
    });

    it('should handle empty content', () => {
      expect(isJsonContent('')).toBe(false);
      expect(isJsonContent('   ')).toBe(false);
    });
  });

  describe('parseMessageContent', () => {
    it('should parse plain text as-is', () => {
      const result = parseMessageContent('Hello, world!');
      expect(result.isStructured).toBe(false);
      expect(result.displayText).toBe('Hello, world!');
      expect(result.metadata).toBeUndefined();
    });

    it('should extract response field from structured JSON', () => {
      const json = JSON.stringify({
        response: 'Hello!',
        reasoning: 'User greeted me',
      });
      
      const result = parseMessageContent(json);
      expect(result.isStructured).toBe(true);
      expect(result.displayText).toBe('Hello!');
      expect(result.metadata).toEqual({ reasoning: 'User greeted me' });
    });

    it('should handle structured JSON with only response field', () => {
      const json = JSON.stringify({
        response: 'Just a response',
      });
      
      const result = parseMessageContent(json);
      expect(result.isStructured).toBe(true);
      expect(result.displayText).toBe('Just a response');
      expect(result.metadata).toBeUndefined();
    });

    it('should pretty-print JSON without response field', () => {
      const json = JSON.stringify({
        events: [
          { name: 'Meeting', date: '2024-12-30' },
        ],
      });
      
      const result = parseMessageContent(json);
      expect(result.isStructured).toBe(true);
      expect(result.displayText).toContain('events');
      expect(result.displayText).toContain('Meeting');
      expect(result.rawData).toBeDefined();
    });

    it('should include all metadata fields except response', () => {
      const json = JSON.stringify({
        response: 'Answer',
        reasoning: 'Because',
        confidence: 0.95,
        sources: ['doc1', 'doc2'],
      });
      
      const result = parseMessageContent(json);
      expect(result.isStructured).toBe(true);
      expect(result.displayText).toBe('Answer');
      expect(result.metadata).toEqual({
        reasoning: 'Because',
        confidence: 0.95,
        sources: ['doc1', 'doc2'],
      });
    });
  });

  describe('looksLikeIncompleteJson', () => {
    it('should detect incomplete JSON objects', () => {
      expect(looksLikeIncompleteJson('{"response":')).toBe(true);
      expect(looksLikeIncompleteJson('{"a": 1, "b"')).toBe(true);
    });

    it('should detect complete JSON objects', () => {
      expect(looksLikeIncompleteJson('{"response":"hi"}')).toBe(false);
      expect(looksLikeIncompleteJson('{"a":1,"b":2}')).toBe(false);
    });

    it('should detect incomplete JSON arrays', () => {
      expect(looksLikeIncompleteJson('[1, 2')).toBe(true);
      expect(looksLikeIncompleteJson('[{"a":1}')).toBe(true);
    });

    it('should detect complete JSON arrays', () => {
      expect(looksLikeIncompleteJson('[1, 2, 3]')).toBe(false);
      expect(looksLikeIncompleteJson('[{"a":1}]')).toBe(false);
    });

    it('should return false for non-JSON content', () => {
      expect(looksLikeIncompleteJson('Hello world')).toBe(false);
      expect(looksLikeIncompleteJson('123')).toBe(false);
    });
  });
});

