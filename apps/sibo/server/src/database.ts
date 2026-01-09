import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location - use data directory in production
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'sibo.db');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- User preferences table
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    tolerances_foods TEXT DEFAULT '[]',
    tolerances_fodmap_types TEXT DEFAULT '[]',
    tolerances_categories TEXT DEFAULT '[]',
    sensitivities_foods TEXT DEFAULT '[]',
    sensitivities_fodmap_types TEXT DEFAULT '[]',
    sensitivities_categories TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Conversations table
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Messages table
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  -- Memory/facts table for long-term user facts (industry best practice)
  CREATE TABLE IF NOT EXISTS user_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'goal', 'context')),
    content TEXT NOT NULL,
    source TEXT, -- which conversation/message this came from
    confidence REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_memories_user ON user_memories(user_id);
  CREATE INDEX IF NOT EXISTS idx_memories_type ON user_memories(memory_type);
`);

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferencesDB {
  id: number;
  user_id: number;
  tolerances_foods: string;
  tolerances_fodmap_types: string;
  tolerances_categories: string;
  sensitivities_foods: string;
  sensitivities_fodmap_types: string;
  sensitivities_categories: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageDB {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  created_at: string;
}

export interface UserMemory {
  id: number;
  user_id: number;
  memory_type: 'fact' | 'preference' | 'goal' | 'context';
  content: string;
  source: string | null;
  confidence: number;
  created_at: string;
  updated_at: string;
  is_active: number;
}

// User operations
export const userOps: {
  findByGoogleId: Statement<[string], User>;
  create: Statement<[string, string, string | null, string | null]>;
  update: Statement<[string | null, string | null, string]>;
  findById: Statement<[number], User>;
} = {
  findByGoogleId: db.prepare<[string], User>('SELECT * FROM users WHERE google_id = ?'),

  create: db.prepare<[string, string, string | null, string | null]>(
    'INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)'
  ),

  update: db.prepare<[string | null, string | null, string]>(
    'UPDATE users SET name = ?, picture = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?'
  ),

  findById: db.prepare<[number], User>('SELECT * FROM users WHERE id = ?'),
};

// Preferences operations
export const preferencesOps: {
  findByUserId: Statement<[number], UserPreferencesDB>;
  upsert: Statement<[number, string, string, string, string, string, string]>;
} = {
  findByUserId: db.prepare<[number], UserPreferencesDB>(
    'SELECT * FROM user_preferences WHERE user_id = ?'
  ),

  upsert: db.prepare<[number, string, string, string, string, string, string]>(`
    INSERT INTO user_preferences (user_id, tolerances_foods, tolerances_fodmap_types, tolerances_categories,
      sensitivities_foods, sensitivities_fodmap_types, sensitivities_categories)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      tolerances_foods = excluded.tolerances_foods,
      tolerances_fodmap_types = excluded.tolerances_fodmap_types,
      tolerances_categories = excluded.tolerances_categories,
      sensitivities_foods = excluded.sensitivities_foods,
      sensitivities_fodmap_types = excluded.sensitivities_fodmap_types,
      sensitivities_categories = excluded.sensitivities_categories,
      updated_at = CURRENT_TIMESTAMP
  `),
};

// Conversation operations
export const conversationOps: {
  create: Statement<[number, string | null]>;
  findByUserId: Statement<[number], Conversation>;
  findById: Statement<[number], Conversation>;
  updateTitle: Statement<[string, number]>;
  delete: Statement<[number]>;
  touch: Statement<[number]>;
} = {
  create: db.prepare<[number, string | null]>(
    'INSERT INTO conversations (user_id, title) VALUES (?, ?)'
  ),

  findByUserId: db.prepare<[number], Conversation>(
    'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC'
  ),

  findById: db.prepare<[number], Conversation>(
    'SELECT * FROM conversations WHERE id = ?'
  ),

  updateTitle: db.prepare<[string, number]>(
    'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),

  delete: db.prepare<[number]>(
    'DELETE FROM conversations WHERE id = ?'
  ),

  touch: db.prepare<[number]>(
    'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
};

// Message operations
export const messageOps: {
  create: Statement<[number, string, string, string | null]>;
  findByConversationId: Statement<[number], MessageDB>;
  deleteByConversationId: Statement<[number]>;
} = {
  create: db.prepare<[number, string, string, string | null]>(
    'INSERT INTO messages (conversation_id, role, content, image_url) VALUES (?, ?, ?, ?)'
  ),

  findByConversationId: db.prepare<[number], MessageDB>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ),

  deleteByConversationId: db.prepare<[number]>(
    'DELETE FROM messages WHERE conversation_id = ?'
  ),
};

// Memory operations (for long-term facts)
export const memoryOps: {
  create: Statement<[number, string, string, string | null, number]>;
  findByUserId: Statement<[number], UserMemory>;
  findByType: Statement<[number, string], UserMemory>;
  update: Statement<[string, number, number]>;
  deactivate: Statement<[number]>;
  delete: Statement<[number]>;
} = {
  create: db.prepare<[number, string, string, string | null, number]>(
    'INSERT INTO user_memories (user_id, memory_type, content, source, confidence) VALUES (?, ?, ?, ?, ?)'
  ),

  findByUserId: db.prepare<[number], UserMemory>(
    'SELECT * FROM user_memories WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC'
  ),

  findByType: db.prepare<[number, string], UserMemory>(
    'SELECT * FROM user_memories WHERE user_id = ? AND memory_type = ? AND is_active = 1'
  ),

  update: db.prepare<[string, number, number]>(
    'UPDATE user_memories SET content = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),

  deactivate: db.prepare<[number]>(
    'UPDATE user_memories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),

  delete: db.prepare<[number]>(
    'DELETE FROM user_memories WHERE id = ?'
  ),
};

// Helper functions
export function getOrCreateUser(googleId: string, email: string, name: string | null, picture: string | null): User {
  let user = userOps.findByGoogleId.get(googleId);

  if (!user) {
    const result = userOps.create.run(googleId, email, name, picture);
    user = userOps.findById.get(result.lastInsertRowid as number)!;
  } else {
    // Update user info on each login
    userOps.update.run(name, picture, googleId);
    user = userOps.findByGoogleId.get(googleId)!;
  }

  return user;
}

export function getUserPreferences(userId: number) {
  const prefs = preferencesOps.findByUserId.get(userId);
  if (!prefs) {
    return {
      tolerances: { foods: [], fodmapTypes: [], categories: [] },
      sensitivities: { foods: [], fodmapTypes: [], categories: [] },
    };
  }

  return {
    tolerances: {
      foods: JSON.parse(prefs.tolerances_foods),
      fodmapTypes: JSON.parse(prefs.tolerances_fodmap_types),
      categories: JSON.parse(prefs.tolerances_categories),
    },
    sensitivities: {
      foods: JSON.parse(prefs.sensitivities_foods),
      fodmapTypes: JSON.parse(prefs.sensitivities_fodmap_types),
      categories: JSON.parse(prefs.sensitivities_categories),
    },
  };
}

export function saveUserPreferences(userId: number, preferences: {
  tolerances: { foods: string[]; fodmapTypes: string[]; categories: string[] };
  sensitivities: { foods: string[]; fodmapTypes: string[]; categories: string[] };
}) {
  preferencesOps.upsert.run(
    userId,
    JSON.stringify(preferences.tolerances.foods),
    JSON.stringify(preferences.tolerances.fodmapTypes),
    JSON.stringify(preferences.tolerances.categories),
    JSON.stringify(preferences.sensitivities.foods),
    JSON.stringify(preferences.sensitivities.fodmapTypes),
    JSON.stringify(preferences.sensitivities.categories)
  );
}

export function getUserConversations(userId: number): Conversation[] {
  return conversationOps.findByUserId.all(userId);
}

export function getConversationMessages(conversationId: number): MessageDB[] {
  return messageOps.findByConversationId.all(conversationId);
}

export function createConversation(userId: number, title: string | null = null): Conversation {
  const result = conversationOps.create.run(userId, title);
  return conversationOps.findById.get(result.lastInsertRowid as number)!;
}

export function addMessage(conversationId: number, role: 'user' | 'assistant', content: string, imageUrl: string | null = null) {
  messageOps.create.run(conversationId, role, content, imageUrl);
  conversationOps.touch.run(conversationId);
}

export function deleteConversation(conversationId: number) {
  messageOps.deleteByConversationId.run(conversationId);
  conversationOps.delete.run(conversationId);
}

export function getUserMemories(userId: number): UserMemory[] {
  return memoryOps.findByUserId.all(userId);
}

export function addUserMemory(
  userId: number,
  memoryType: 'fact' | 'preference' | 'goal' | 'context',
  content: string,
  source: string | null = null,
  confidence: number = 1.0
) {
  memoryOps.create.run(userId, memoryType, content, source, confidence);
}

export default db;
