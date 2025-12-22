# SIBO Assistant Memory System

This document describes the memory and personalization system implemented in the SIBO Assistant, including architecture decisions, industry best practices comparisons, and usage guidelines.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Memory Types](#memory-types)
4. [Data Flow](#data-flow)
5. [API Reference](#api-reference)
6. [Industry Best Practices Comparison](#industry-best-practices-comparison)
7. [Privacy & Security](#privacy--security)
8. [Future Improvements](#future-improvements)

---

## Overview

The SIBO Assistant memory system enables personalized dietary recommendations by:

1. **Authenticating users** via Google OAuth for cross-device persistence
2. **Storing food tolerances and sensitivities** that personalize AI responses
3. **Preserving conversation history** for continuity across sessions
4. **Maintaining long-term user facts** (memories) for enhanced personalization

### Key Benefits

- **Cross-device sync**: Sign in with Google to access preferences anywhere
- **Personalized recommendations**: AI knows your specific tolerances
- **Conversation continuity**: Pick up where you left off
- **Privacy controls**: View and delete your stored data anytime

---

## Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | SQLite (better-sqlite3) | Persistent storage |
| Authentication | Google OAuth 2.0 + JWT | User identity |
| Backend | Express.js + TypeScript | API server |
| Frontend | React + TypeScript | User interface |
| AI | Claude (Anthropic API) | Conversational AI |

### Database Schema

```
users                     user_preferences
┌─────────────────┐      ┌───────────────────────────┐
│ id (PK)         │      │ user_id (FK)              │
│ google_id       │──┬──▶│ tolerances_foods          │
│ email           │  │   │ tolerances_fodmap_types   │
│ name            │  │   │ tolerances_categories     │
│ picture         │  │   │ sensitivities_foods       │
│ created_at      │  │   │ sensitivities_fodmap_types│
│ updated_at      │  │   │ sensitivities_categories  │
└─────────────────┘  │   └───────────────────────────┘
                     │
                     │   conversations              messages
                     │   ┌─────────────────┐       ┌─────────────────┐
                     ├──▶│ id (PK)         │──────▶│ conversation_id │
                     │   │ user_id (FK)    │       │ role            │
                     │   │ title           │       │ content         │
                     │   │ created_at      │       │ image_url       │
                     │   │ updated_at      │       │ created_at      │
                     │   └─────────────────┘       └─────────────────┘
                     │
                     │   user_memories
                     │   ┌─────────────────┐
                     └──▶│ id (PK)         │
                         │ user_id (FK)    │
                         │ memory_type     │
                         │ content         │
                         │ confidence      │
                         │ is_active       │
                         └─────────────────┘
```

### Authentication Flow

```
1. User clicks "Sign in with Google"
2. Google returns OAuth credential (ID token)
3. Backend verifies token with Google
4. Backend creates/updates user record
5. Backend issues JWT for session
6. Frontend stores JWT for API calls
7. Subsequent requests include JWT header
```

---

## Memory Types

### 1. Short-Term Memory (Session Context)

- **Scope**: Current conversation only
- **Storage**: React state (frontend) + request body
- **Lifetime**: Until page refresh or conversation reset
- **Purpose**: Maintains conversation flow for contextual responses

### 2. User Preferences (Tolerances & Sensitivities)

- **Scope**: Cross-session, cross-device
- **Storage**: SQLite `user_preferences` table
- **Lifetime**: Persists until user clears
- **Purpose**: Personalizes FODMAP recommendations

**Structure:**
```typescript
interface UserPreferences {
  tolerances: {
    foods: string[];      // e.g., ["milk", "yogurt"]
    fodmapTypes: string[]; // e.g., ["lactose"]
    categories: string[]; // e.g., ["dairy"]
  };
  sensitivities: {
    foods: string[];
    fodmapTypes: string[];
    categories: string[];
  };
}
```

### 3. Conversation History

- **Scope**: Per-user, organized by conversation
- **Storage**: SQLite `conversations` + `messages` tables
- **Lifetime**: Persists until user deletes
- **Purpose**: Enables continuity and reference to past discussions

### 4. Long-Term Memories (User Facts)

- **Scope**: Cross-session, cross-device
- **Storage**: SQLite `user_memories` table
- **Lifetime**: Persists until deactivated/deleted
- **Purpose**: Stores extracted facts for enhanced personalization

**Memory Types:**
- `fact`: General user facts
- `preference`: Dietary preferences beyond tolerances
- `goal`: User's health goals
- `context`: Important contextual information

---

## Data Flow

### Preference Detection Flow

```
User Message: "I can eat dairy fine"
         │
         ▼
┌─────────────────────────────────┐
│   Pattern Matching (Backend)    │
│   detectPreferenceInResponse()  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Detected: tolerance, ["dairy"]│
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Frontend processes items      │
│   Updates preferences state     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Sync to Backend (if auth'd)   │
│   POST /api/preferences         │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Also saved to localStorage    │
│   (backup for offline use)      │
└─────────────────────────────────┘
```

### Authenticated Request Flow

```
Frontend Request
     │
     ├── Authorization: Bearer <JWT>
     │
     ▼
┌─────────────────┐
│ authMiddleware  │
└────────┬────────┘
         │
         ├── Valid JWT → Attach user to req
         │
         ▼
┌─────────────────┐
│  Route Handler  │
└────────┬────────┘
         │
         ▼
    Database Op
```

---

## API Reference

### Authentication

#### POST /api/auth/google
Authenticate with Google OAuth credential.

**Request:**
```json
{
  "credential": "eyJhbGciOiJSUzI1NiIsInR5cCI6..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://..."
  }
}
```

#### GET /api/auth/me
Get current authenticated user.

**Headers:** `Authorization: Bearer <token>`

### Preferences

#### GET /api/preferences
Get user preferences.

#### POST /api/preferences
Save user preferences.

**Request:**
```json
{
  "preferences": {
    "tolerances": { "foods": [], "fodmapTypes": ["lactose"], "categories": [] },
    "sensitivities": { "foods": [], "fodmapTypes": [], "categories": [] }
  }
}
```

### Conversations

#### GET /api/conversations
List all user conversations.

#### POST /api/conversations
Create a new conversation.

#### GET /api/conversations/:id/messages
Get messages for a conversation.

#### POST /api/conversations/:id/messages
Add a message to a conversation.

#### DELETE /api/conversations/:id
Delete a conversation.

### Memories

#### GET /api/memories
Get user's long-term memories.

#### POST /api/memories
Add a new memory.

**Request:**
```json
{
  "memoryType": "fact",
  "content": "User has IBS-D symptoms",
  "source": "conversation-123",
  "confidence": 0.9
}
```

---

## Industry Best Practices Comparison

### How Our Implementation Compares to Industry Leaders

Based on research of ChatGPT, Claude, Perplexity, and other AI assistants with memory features (2024-2025), here's how our implementation aligns:

| Feature | ChatGPT | Claude | SIBO Assistant | Assessment |
|---------|---------|--------|----------------|------------|
| **Memory Architecture** | Multi-layered (session metadata + facts + summaries) | File-based (CLAUDE.md) | SQLite + localStorage hybrid | ✅ Good - Hybrid approach with offline fallback |
| **User Control** | Edit/delete memories | Edit/delete via file | View/clear preferences | ✅ Matches standards |
| **Cross-device Sync** | Yes (all tiers now) | Yes (Pro/Enterprise) | Yes (when authenticated) | ✅ Parity achieved |
| **Privacy Siloing** | By conversation context | By project | By user account | ✅ Appropriate for single-purpose app |
| **Preference Detection** | AI-driven extraction | AI-driven | Pattern matching + AI | ✅ More deterministic |
| **Context Efficiency** | Smart summarization | Context editing | Fresh per session | ⚠️ Room for improvement |

### Key Best Practices Applied

#### 1. Layered Memory Architecture ✅

**Industry Recommendation** (OpenAI, Anthropic):
> "Use different memory layers for different purposes - session context, user facts, and conversation history should be managed separately."

**Our Implementation:**
- **Short-term**: Session state for current conversation
- **Medium-term**: User preferences (tolerances/sensitivities)
- **Long-term**: User memories table for facts and goals

#### 2. User Control & Transparency ✅

**Industry Recommendation** (EDPB 2024 AI Guidelines):
> "Users must be able to view, edit, and delete their stored data. Memory must align with GDPR principles."

**Our Implementation:**
- Preferences panel shows all stored tolerances/sensitivities
- "Clear All Preferences" button for full reset
- Clear visual indication of what's being remembered
- Conversations can be deleted

#### 3. Efficient Token Management ✅

**Industry Recommendation** (Anthropic Context Engineering):
> "The art of compaction lies in the selection of what to keep versus what to discard."

**Our Implementation:**
- Only inject relevant preferences into system prompt
- Pattern matching for preference detection (no extra AI calls)
- Fresh conversation per session (no history bloat)

#### 4. Hybrid Storage Strategy ✅

**Industry Recommendation** (Vellum AI, LangChain):
> "Use a combination of in-memory and persistent storage for flexibility."

**Our Implementation:**
- SQLite for authenticated users (cross-device)
- localStorage as fallback (offline functionality)
- Automatic sync when authenticated

### Areas Where We Differ (By Design)

1. **No Conversation Summarization**: Unlike ChatGPT which summarizes old conversations, we start fresh each session. This is intentional for a focused use case.

2. **Deterministic Detection**: We use regex patterns rather than AI for preference detection, providing predictable behavior and reducing costs.

3. **Domain-Specific Memory**: Rather than general facts, we focus on FODMAP-specific tolerances and sensitivities.

### Recommendations from Industry Research

Based on trends from ChatGPT Memory, Claude Memory, and Perplexity:

1. **Consider adding conversation summarization** for users who want continuity
2. **Add confidence scoring** to preferences (some platforms track certainty)
3. **Implement memory aging** to reduce weight of older memories
4. **Add semantic search** for larger memory stores (vector embeddings)

---

## Privacy & Security

### Data Storage

| Data Type | Location | Encryption | Retention |
|-----------|----------|------------|-----------|
| User account | SQLite | At rest (OS-level) | Until deletion |
| Preferences | SQLite + localStorage | At rest | Until cleared |
| Conversations | SQLite | At rest | Until deleted |
| JWT tokens | localStorage | In transit (HTTPS) | 7 days |

### Security Measures

1. **OAuth 2.0**: Industry-standard authentication via Google
2. **JWT tokens**: Stateless, expiring session tokens (7 days)
3. **HTTPS**: All production traffic encrypted in transit
4. **CORS**: Configured for same-origin requests
5. **Input validation**: All API inputs validated

### GDPR Considerations

- **Right to access**: Users can view all their stored preferences
- **Right to deletion**: Users can delete conversations and clear preferences
- **Data minimization**: Only collect necessary data
- **Consent**: Explicit sign-in action implies consent

---

## Future Improvements

Based on industry trends and user needs:

### Short-Term

- [ ] Add data export feature (download your data)
- [ ] Implement conversation history persistence UI
- [ ] Add preference version history
- [ ] Create memory confidence scoring

### Long-Term

- [ ] Semantic memory with vector embeddings
- [ ] Conversation summarization for context efficiency
- [ ] Proactive preference suggestions based on patterns
- [ ] Share preferences with healthcare providers

---

## Configuration

### Required Environment Variables

**Server (.env):**
```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
JWT_SECRET=your-secure-jwt-secret
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

**Frontend (.env):**
```bash
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
```

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Set authorized JavaScript origins (e.g., `http://localhost:5173`, your production URL)
4. Set authorized redirect URIs
5. Copy the Client ID to both server and frontend environment files

---

## References

- [OpenAI Memory Feature](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- [Anthropic Context Management](https://anthropic.com/news/context-management)
- [Claude Memory Documentation](https://docs.claude.com/en/docs/claude-code/memory)
- [LangChain Memory Patterns](https://www.analyticsvidhya.com/blog/2024/11/langchain-memory/)
- [EDPB AI Guidelines 2024](https://edpb.europa.eu/)
