import { describe, it, expect } from 'vitest';
import { verifyTwilioSignature, formDataToObject } from './twilioSignature';

describe('verifyTwilioSignature', () => {
  it('should return true for valid signature', async () => {
    const authToken = 'test-auth-token';
    const url = 'https://example.com/twilio/voice';
    const params = {
      From: '+15551234567',
      To: '+15559876543',
      CallSid: 'CA123',
    };

    // Calculate the expected signature
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + params[key as keyof typeof params];
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(authToken),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    const result = await verifyTwilioSignature(authToken, expectedSignature, url, params);

    expect(result).toBe(true);
  });

  it('should return false for invalid signature', async () => {
    const authToken = 'test-auth-token';
    const url = 'https://example.com/twilio/voice';
    const params = {
      From: '+15551234567',
      To: '+15559876543',
    };

    const result = await verifyTwilioSignature(authToken, 'invalid-signature', url, params);

    expect(result).toBe(false);
  });

  it('should handle empty params', async () => {
    const authToken = 'test-auth-token';
    const url = 'https://example.com/twilio/voice';
    const params = {};

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(authToken),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(url));
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    const result = await verifyTwilioSignature(authToken, expectedSignature, url, params);

    expect(result).toBe(true);
  });
});

describe('formDataToObject', () => {
  it('should convert FormData to plain object', () => {
    const formData = new FormData();
    formData.append('name', 'John');
    formData.append('age', '30');

    const result = formDataToObject(formData);

    expect(result).toEqual({
      name: 'John',
      age: '30',
    });
  });

  it('should handle empty FormData', () => {
    const formData = new FormData();

    const result = formDataToObject(formData);

    expect(result).toEqual({});
  });

  it('should skip non-string values', () => {
    const formData = new FormData();
    formData.append('name', 'John');
    formData.append('file', new Blob(['test']));

    const result = formDataToObject(formData);

    expect(result).toEqual({
      name: 'John',
    });
  });
});
