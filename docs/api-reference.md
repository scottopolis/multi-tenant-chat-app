# API Reference

This document describes the REST API endpoints provided by the Cloudflare Worker backend.

## Base URL

- **Development:** `http://localhost:8787`
- **Production:** `https://your-worker.workers.dev`

## Authentication

> **Note:** Authentication is not currently implemented. All requests use a default organization ID.

Future authentication will use JWT tokens:
```
Authorization: Bearer <token>
```

## Endpoints

### Health Check

Check if the API is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-24T12:00:00.000Z"
}
```

---

### Create Chat

Create a new chat conversation.

**Endpoint:** `POST /api/chats`

**Request Body:**
```json
{
  "title": "My Chat" // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "orgId": "default",
  "title": "My Chat",
  "createdAt": "2024-12-24T12:00:00.000Z"
}
```

---

### List Chats

Get all chats for the current organization.

**Endpoint:** `GET /api/chats`

**Response:** `200 OK`
```json
{
  "chats": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "orgId": "default",
      "title": "My Chat",
      "createdAt": "2024-12-24T12:00:00.000Z"
    }
  ]
}
```

---

### Get Chat

Get a single chat with all its messages.

**Endpoint:** `GET /api/chats/:chatId`

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "orgId": "default",
  "title": "My Chat",
  "createdAt": "2024-12-24T12:00:00.000Z",
  "messages": [
    {
      "id": "msg-1",
      "chatId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "user",
      "content": "Hello!",
      "createdAt": "2024-12-24T12:00:00.000Z"
    },
    {
      "id": "msg-2",
      "chatId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "assistant",
      "content": "Hi! How can I help you?",
      "createdAt": "2024-12-24T12:00:01.000Z"
    }
  ]
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Chat not found"
}
```

---

### Send Message

Send a message and receive a streaming response.

**Endpoint:** `POST /api/chats/:chatId/messages`

**Request Body:**
```json
{
  "content": "What's the weather like?",
  "model": "gpt-4.1-mini" // optional, defaults to gpt-4.1-mini
}
```

**Response:** `200 OK` (Server-Sent Events stream)

The response is a stream of Server-Sent Events (SSE):

```
event: text
data: Hello

event: text
data: ! How

event: text
data:  can I

event: text
data:  help?

event: done
data: {"messageId":"msg-123","finishReason":"stop"}
```

**Event Types:**

- `text` - A chunk of the assistant's response
- `done` - The response is complete
- `error` - An error occurred during generation

**Error Response:** `400 Bad Request`
```json
{
  "error": "Invalid request",
  "details": [
    {
      "path": ["content"],
      "message": "Message content is required"
    }
  ]
}
```

---

### List Models

Get available AI models.

**Endpoint:** `GET /api/models`

**Response:** `200 OK`
```json
{
  "models": [
    {
      "name": "gpt-4.1-mini",
      "description": "Fast and affordable"
    },
    {
      "name": "gpt-4.1",
      "description": "Balanced performance"
    },
    {
      "name": "claude-3.5-sonnet",
      "description": "Excellent reasoning"
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": "Optional additional details"
}
```

**Common Status Codes:**

- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid or missing auth token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (something went wrong)

## Rate Limiting

> **Note:** Rate limiting is not currently implemented.

Future implementations will include per-organization rate limits.



