import { useState, useRef, useEffect, useCallback } from 'react';
import type { Food, FodmapType } from '../types/food';
import { allFoods } from '../data/foods';
import './ChatWindow.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface UserPreferences {
  tolerances: {
    // Foods or categories the user can tolerate
    foods: string[]; // food IDs
    fodmapTypes: FodmapType[]; // FODMAP types they tolerate (e.g., lactose)
    categories: string[]; // categories like "dairy", "legumes"
  };
  sensitivities: {
    // Foods or categories the user is sensitive to
    foods: string[];
    fodmapTypes: FodmapType[];
    categories: string[];
  };
}

interface ChatWindowProps {
  onFoodClick: (food: Food) => void;
}

const PREFERENCES_KEY = 'sibo-assistant-preferences';

const DEFAULT_PREFERENCES: UserPreferences = {
  tolerances: { foods: [], fodmapTypes: [], categories: [] },
  sensitivities: { foods: [], fodmapTypes: [], categories: [] },
};

// Mapping of common terms to FODMAP types
const FODMAP_KEYWORDS: Record<string, FodmapType> = {
  lactose: 'lactose',
  dairy: 'lactose',
  milk: 'lactose',
  fructose: 'fructose',
  fructans: 'fructans',
  wheat: 'fructans',
  garlic: 'fructans',
  onion: 'fructans',
  galactans: 'galactans',
  gos: 'galactans',
  beans: 'galactans',
  legumes: 'galactans',
  sorbitol: 'polyols-sorbitol',
  mannitol: 'polyols-mannitol',
  polyols: 'polyols-sorbitol',
};

// Category keywords
const CATEGORY_KEYWORDS = [
  'dairy',
  'vegetables',
  'fruits',
  'grains',
  'legumes',
  'proteins',
  'sweeteners',
];

export function ChatWindow({ onFoodClick }: ChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [showPreferences, setShowPreferences] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Generate welcome message based on preferences
  const getWelcomeMessage = useCallback((): Message => {
    const hasPref =
      preferences.tolerances.foods.length > 0 ||
      preferences.tolerances.fodmapTypes.length > 0 ||
      preferences.tolerances.categories.length > 0;

    let content =
      'Hi! Ask me about any food to learn if it\'s safe to eat with SIBO. For example, try "Can I eat garlic?" or "What about broccoli?"';

    if (hasPref) {
      content +=
        '\n\n*I remember your tolerances and will personalize my recommendations.*';
    } else {
      content +=
        '\n\n*Tip: Tell me about your personal tolerances (e.g., "I can handle dairy fine") and I\'ll remember them!*';
    }

    return { id: 'welcome', role: 'assistant', content };
  }, [preferences]);

  // Initialize messages with welcome
  useEffect(() => {
    setMessages([getWelcomeMessage()]);
  }, [getWelcomeMessage]);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const findFoodInDatabase = (text: string): Food | undefined => {
    const lowerText = text.toLowerCase();
    return allFoods.find(
      (food) =>
        food.name.toLowerCase() === lowerText ||
        food.aliases?.some((alias) => alias.toLowerCase() === lowerText)
    );
  };

  const findFoodsInText = (text: string): { food: Food; match: string }[] => {
    const found: { food: Food; match: string }[] = [];
    const lowerText = text.toLowerCase();

    for (const food of allFoods) {
      const nameLower = food.name.toLowerCase();
      if (lowerText.includes(nameLower)) {
        found.push({ food, match: food.name });
      } else if (food.aliases) {
        for (const alias of food.aliases) {
          if (lowerText.includes(alias.toLowerCase())) {
            found.push({ food, match: alias });
            break;
          }
        }
      }
    }

    return found;
  };

  // Detect if user is sharing tolerance/sensitivity information
  const detectPreferenceStatement = (
    message: string
  ): { type: 'tolerance' | 'sensitivity'; items: string[] } | null => {
    const lowerMessage = message.toLowerCase();

    // Tolerance patterns
    const tolerancePatterns = [
      /i (?:can|could) (?:eat|have|handle|tolerate|digest) (.+?)(?:\s+(?:fine|ok|okay|well|no problem|without issues?))?(?:\.|$)/i,
      /(.+?) (?:is|are) (?:fine|ok|okay) (?:for me|with me)/i,
      /i(?:'m| am) (?:fine|ok|okay|good) with (.+)/i,
      /i don'?t have (?:a )?(?:problem|issue|trouble) with (.+)/i,
      /(.+?) (?:doesn'?t|don'?t|does not|do not) (?:bother|affect|upset) me/i,
      /i tolerate (.+?) (?:well|fine|ok)/i,
    ];

    // Sensitivity patterns
    const sensitivityPatterns = [
      /i (?:can'?t|cannot|couldn'?t) (?:eat|have|handle|tolerate|digest) (.+)/i,
      /(.+?) (?:bothers?|upsets?|affects?) me/i,
      /i(?:'m| am) sensitive to (.+)/i,
      /i have (?:a )?(?:problem|issue|trouble) with (.+)/i,
      /(.+?) (?:makes?|make) me (?:sick|bloated|uncomfortable)/i,
      /i react (?:badly )?to (.+)/i,
    ];

    for (const pattern of tolerancePatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const items = match[1]
          .split(/,|and/)
          .map((s) => s.trim().replace(/[.!?]$/, ''))
          .filter((s) => s.length > 0);
        return { type: 'tolerance', items };
      }
    }

    for (const pattern of sensitivityPatterns) {
      const match = lowerMessage.match(pattern);
      if (match) {
        const items = match[1]
          .split(/,|and/)
          .map((s) => s.trim().replace(/[.!?]$/, ''))
          .filter((s) => s.length > 0);
        return { type: 'sensitivity', items };
      }
    }

    return null;
  };

  // Process and save preference
  const processPreference = (
    type: 'tolerance' | 'sensitivity',
    items: string[]
  ): string => {
    const newPrefs = { ...preferences };
    const target =
      type === 'tolerance' ? newPrefs.tolerances : newPrefs.sensitivities;
    const remembered: string[] = [];

    for (const item of items) {
      const lowerItem = item.toLowerCase();

      // Check if it's a FODMAP type keyword
      const fodmapType = FODMAP_KEYWORDS[lowerItem];
      if (fodmapType && !target.fodmapTypes.includes(fodmapType)) {
        target.fodmapTypes.push(fodmapType);
        remembered.push(formatFodmapType(fodmapType));
        continue;
      }

      // Check if it's a category
      if (
        CATEGORY_KEYWORDS.includes(lowerItem) &&
        !target.categories.includes(lowerItem)
      ) {
        target.categories.push(lowerItem);
        remembered.push(lowerItem);
        continue;
      }

      // Check if it's a specific food
      const food = findFoodInDatabase(item);
      if (food && !target.foods.includes(food.id)) {
        target.foods.push(food.id);
        remembered.push(food.name);
      }
    }

    if (remembered.length > 0) {
      setPreferences(newPrefs);
      const action = type === 'tolerance' ? 'can tolerate' : 'are sensitive to';
      return `Got it! I'll remember that you ${action} **${remembered.join(', ')}**. I'll keep this in mind for future recommendations.`;
    }

    return '';
  };

  // Check if a food is tolerated based on preferences
  const isFoodTolerated = (food: Food): boolean => {
    // Check if specifically marked as tolerated
    if (preferences.tolerances.foods.includes(food.id)) {
      return true;
    }

    // Check if category is tolerated
    if (preferences.tolerances.categories.includes(food.category)) {
      return true;
    }

    // Check if all FODMAP types in this food are tolerated
    if (food.fodmapTypes.length > 0) {
      const allTolerated = food.fodmapTypes.every((ft) =>
        preferences.tolerances.fodmapTypes.includes(ft)
      );
      if (allTolerated) {
        return true;
      }
    }

    return false;
  };

  // Check if a food should be avoided based on sensitivities
  const isFoodSensitive = (food: Food): boolean => {
    if (preferences.sensitivities.foods.includes(food.id)) {
      return true;
    }

    if (preferences.sensitivities.categories.includes(food.category)) {
      return true;
    }

    // Check if any FODMAP type in this food is a sensitivity
    if (food.fodmapTypes.length > 0) {
      const anySensitive = food.fodmapTypes.some((ft) =>
        preferences.sensitivities.fodmapTypes.includes(ft)
      );
      if (anySensitive) {
        return true;
      }
    }

    return false;
  };

  const generateLocalResponse = (userMessage: string): string => {
    // First check if this is a preference statement
    const prefStatement = detectPreferenceStatement(userMessage);
    if (prefStatement) {
      const response = processPreference(prefStatement.type, prefStatement.items);
      if (response) {
        return response;
      }
    }

    // Check for preference management commands
    const lowerMessage = userMessage.toLowerCase();
    if (
      lowerMessage.includes('what do you remember') ||
      lowerMessage.includes('my preferences') ||
      lowerMessage.includes('what have i told you')
    ) {
      return getPreferencesSummary();
    }

    if (
      lowerMessage.includes('forget everything') ||
      lowerMessage.includes('clear my preferences') ||
      lowerMessage.includes('reset memory')
    ) {
      setPreferences(DEFAULT_PREFERENCES);
      return "I've cleared all your saved preferences. We're starting fresh!";
    }

    // Find foods mentioned in the message
    const mentionedFoods = findFoodsInText(userMessage);

    if (mentionedFoods.length === 0) {
      // Try to extract potential food name from common question patterns
      const patterns = [
        /can i (?:eat|have) (.+?)(?:\?|$)/i,
        /is (.+?) (?:ok|okay|safe|good)/i,
        /what about (.+?)(?:\?|$)/i,
        /(.+?) fodmap/i,
        /tell me about (.+?)(?:\?|$)/i,
      ];

      for (const pattern of patterns) {
        const match = userMessage.match(pattern);
        if (match) {
          const potentialFood = match[1].trim().replace(/[?.,!]$/g, '');
          const food = findFoodInDatabase(potentialFood);
          if (food) {
            mentionedFoods.push({ food, match: potentialFood });
            break;
          }
        }
      }
    }

    if (mentionedFoods.length === 0) {
      return `I don't have information about that specific food in my database yet. Try asking about common vegetables like broccoli, carrots, or garlic. You can also browse the food list above to see what's available.\n\n*Tip: You can also tell me about your personal tolerances, like "I can handle dairy fine"!*`;
    }

    // Generate response based on found foods
    const responses: string[] = [];

    for (const { food } of mentionedFoods) {
      let response = '';
      const tolerated = isFoodTolerated(food);
      const sensitive = isFoodSensitive(food);

      // Add personalization based on preferences
      if (sensitive) {
        response = `⚠️ Based on what you've told me, you're sensitive to **${food.name}**. `;
        response += `You may want to avoid this or be extra careful. `;
      } else if (tolerated && food.fodmapRating !== 'low') {
        response = `Based on your tolerances, **${food.name}** should be okay for you personally, even though it's typically ${food.fodmapRating} FODMAP. `;
      } else if (food.fodmapRating === 'low') {
        response = `**${food.name}** is generally safe for SIBO patients! `;
        if (food.servingSizes.low) {
          response += `A safe serving is ${food.servingSizes.low.grams}g${food.servingSizes.low.cups ? ` (${food.servingSizes.low.cups})` : ''}. `;
        }
      } else if (food.fodmapRating === 'moderate') {
        response = `**${food.name}** requires portion control. `;
        if (food.servingSizes.low) {
          response += `Keep servings to ${food.servingSizes.low.grams}g${food.servingSizes.low.cups ? ` (${food.servingSizes.low.cups})` : ''} to stay low FODMAP. `;
        }
      } else {
        response = `**${food.name}** is high FODMAP and should generally be avoided during SIBO treatment. `;
      }

      response += food.siboNotes;

      if (food.alternatives && food.alternatives.length > 0 && !tolerated) {
        const altNames = food.alternatives
          .map((altId) => {
            const altFood = allFoods.find((f) => f.id === altId);
            return altFood ? altFood.name : altId.replace(/-/g, ' ');
          })
          .join(', ');
        response += ` Consider these alternatives: ${altNames}.`;
      }

      if (food.preparationTips && food.preparationTips.length > 0) {
        response += `\n\n**Tip:** ${food.preparationTips[0]}`;
      }

      response += `\n\n*Click on "${food.name}" above for full details.*`;

      responses.push(response);
    }

    return responses.join('\n\n---\n\n');
  };

  const getPreferencesSummary = (): string => {
    const { tolerances, sensitivities } = preferences;
    const parts: string[] = [];

    const hasTolerance =
      tolerances.foods.length > 0 ||
      tolerances.fodmapTypes.length > 0 ||
      tolerances.categories.length > 0;
    const hasSensitivity =
      sensitivities.foods.length > 0 ||
      sensitivities.fodmapTypes.length > 0 ||
      sensitivities.categories.length > 0;

    if (!hasTolerance && !hasSensitivity) {
      return "I don't have any saved preferences for you yet. Tell me about foods you tolerate well or are sensitive to, and I'll remember!";
    }

    if (hasTolerance) {
      const items: string[] = [];
      tolerances.foods.forEach((id) => {
        const food = allFoods.find((f) => f.id === id);
        if (food) items.push(food.name);
      });
      tolerances.fodmapTypes.forEach((ft) => items.push(formatFodmapType(ft)));
      tolerances.categories.forEach((c) => items.push(c));

      parts.push(`**You tolerate:** ${items.join(', ')}`);
    }

    if (hasSensitivity) {
      const items: string[] = [];
      sensitivities.foods.forEach((id) => {
        const food = allFoods.find((f) => f.id === id);
        if (food) items.push(food.name);
      });
      sensitivities.fodmapTypes.forEach((ft) => items.push(formatFodmapType(ft)));
      sensitivities.categories.forEach((c) => items.push(c));

      parts.push(`**You're sensitive to:** ${items.join(', ')}`);
    }

    parts.push('\n*Say "forget everything" to clear these preferences.*');

    return parts.join('\n\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    // Simulate a small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const response = generateLocalResponse(userMessage);

    const newAssistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: response,
    };

    setMessages((prev) => [...prev, newAssistantMessage]);
    setIsLoading(false);
  };

  const clearPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    setShowPreferences(false);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I've cleared all your saved preferences. We're starting fresh!",
      },
    ]);
  };

  const renderMessageContent = (content: string) => {
    // Parse markdown-like formatting and food links
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let keyIndex = 0;

    // Simple markdown parsing for bold text
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={keyIndex++}>{content.slice(lastIndex, match.index)}</span>
        );
      }

      const boldText = match[1];
      // Check if this bold text is a food name
      const food = findFoodInDatabase(boldText);
      if (food) {
        parts.push(
          <button
            key={keyIndex++}
            className="chat-window__food-link"
            onClick={() => onFoodClick(food)}
          >
            {boldText}
          </button>
        );
      } else {
        parts.push(<strong key={keyIndex++}>{boldText}</strong>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      remaining = content.slice(lastIndex);
      // Split by newlines for proper line breaks
      const lines = remaining.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) {
          parts.push(<br key={keyIndex++} />);
        }
        if (line) {
          // Handle italics
          const italicParts = line.split(/\*(.+?)\*/g);
          italicParts.forEach((part, j) => {
            if (j % 2 === 1) {
              parts.push(<em key={keyIndex++}>{part}</em>);
            } else if (part) {
              parts.push(<span key={keyIndex++}>{part}</span>);
            }
          });
        }
      });
    }

    return parts.length > 0 ? parts : content;
  };

  const hasPreferences =
    preferences.tolerances.foods.length > 0 ||
    preferences.tolerances.fodmapTypes.length > 0 ||
    preferences.tolerances.categories.length > 0 ||
    preferences.sensitivities.foods.length > 0 ||
    preferences.sensitivities.fodmapTypes.length > 0 ||
    preferences.sensitivities.categories.length > 0;

  return (
    <div className={`chat-window ${isOpen ? 'chat-window--open' : ''}`}>
      <button
        className="chat-window__toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Ask about food'}
      >
        {isOpen ? '×' : '💬'}
      </button>

      {isOpen && (
        <div className="chat-window__container">
          <div className="chat-window__header">
            <div className="chat-window__header-content">
              <h3>Food Assistant</h3>
              <p>Ask about any food for SIBO</p>
            </div>
            {hasPreferences && (
              <button
                className="chat-window__prefs-btn"
                onClick={() => setShowPreferences(!showPreferences)}
                title="View your preferences"
              >
                🧠
              </button>
            )}
          </div>

          {showPreferences && (
            <div className="chat-window__prefs-panel">
              <div className="chat-window__prefs-header">
                <strong>Your Preferences</strong>
                <button onClick={() => setShowPreferences(false)}>×</button>
              </div>
              <div className="chat-window__prefs-content">
                {preferences.tolerances.foods.length > 0 ||
                preferences.tolerances.fodmapTypes.length > 0 ||
                preferences.tolerances.categories.length > 0 ? (
                  <div className="chat-window__prefs-section">
                    <span className="chat-window__prefs-label">✓ Tolerate:</span>
                    <span>
                      {[
                        ...preferences.tolerances.foods.map((id) => {
                          const food = allFoods.find((f) => f.id === id);
                          return food?.name || id;
                        }),
                        ...preferences.tolerances.fodmapTypes.map(formatFodmapType),
                        ...preferences.tolerances.categories,
                      ].join(', ')}
                    </span>
                  </div>
                ) : null}
                {preferences.sensitivities.foods.length > 0 ||
                preferences.sensitivities.fodmapTypes.length > 0 ||
                preferences.sensitivities.categories.length > 0 ? (
                  <div className="chat-window__prefs-section">
                    <span className="chat-window__prefs-label">⚠ Sensitive:</span>
                    <span>
                      {[
                        ...preferences.sensitivities.foods.map((id) => {
                          const food = allFoods.find((f) => f.id === id);
                          return food?.name || id;
                        }),
                        ...preferences.sensitivities.fodmapTypes.map(formatFodmapType),
                        ...preferences.sensitivities.categories,
                      ].join(', ')}
                    </span>
                  </div>
                ) : null}
              </div>
              <button
                className="chat-window__prefs-clear"
                onClick={clearPreferences}
              >
                Clear All Preferences
              </button>
            </div>
          )}

          <div className="chat-window__messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-window__message chat-window__message--${message.role}`}
              >
                {renderMessageContent(message.content)}
              </div>
            ))}
            {isLoading && (
              <div className="chat-window__message chat-window__message--assistant chat-window__message--loading">
                <span className="chat-window__typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-window__form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-window__input"
              placeholder="Ask about a food..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="chat-window__send"
              disabled={!input.trim() || isLoading}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function formatFodmapType(type: FodmapType): string {
  const names: Record<FodmapType, string> = {
    fructose: 'Fructose',
    lactose: 'Lactose',
    fructans: 'Fructans',
    galactans: 'Galactans',
    'polyols-sorbitol': 'Sorbitol',
    'polyols-mannitol': 'Mannitol',
  };
  return names[type] || type;
}
