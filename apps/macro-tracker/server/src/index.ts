import express from 'express';
import cors from 'cors';
import { createAgent } from '@monorepo/agent';
import { MACRO_TRACKER_TOOLS } from './tools.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create the AI agent
const agent = createAgent({
  systemPrompt: `You are MacroMeal, an AI assistant that helps users manage their recipes and hit their macro targets.

Your philosophy is "structure without surveillance" - help users design their meal system once so they can eat intuitively without daily tracking.

Key capabilities:
- Search the user's personal recipe library
- Calculate portion sizes to hit specific macro targets
- Suggest dinners based on what's remaining for the day
- Extract recipes from social media video links
- Track daily macro progress

Always be helpful and focused on making macro management effortless. When users ask about macros, portion sizes, or meal suggestions, use your tools to give personalized recommendations from THEIR recipe library.`,
  tools: MACRO_TRACKER_TOOLS,
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'macro-tracker' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const response = await agent.chat(messages);

    res.json({
      message: response.message,
      toolCalls: response.toolCalls,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

// TODO: Add recipe CRUD endpoints
// TODO: Add macro target endpoints
// TODO: Add daily log endpoints
// TODO: Add auth endpoints

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist/public'));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'dist/public' });
  });
}

app.listen(PORT, () => {
  console.log(`MacroMeal server running on port ${PORT}`);
});

export default app;
