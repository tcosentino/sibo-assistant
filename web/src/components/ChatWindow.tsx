import { useState, useRef, useEffect } from 'react';
import type { Food } from '../types/food';
import { allFoods } from '../data/foods';
import './ChatWindow.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  onFoodClick: (food: Food) => void;
}

export function ChatWindow({ onFoodClick }: ChatWindowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! Ask me about any food to learn if it\'s safe to eat with SIBO. For example, try "Can I eat garlic?" or "What about broccoli?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const generateLocalResponse = (userMessage: string): string => {
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
      return `I don't have information about that specific food in my database yet. Try asking about common vegetables like broccoli, carrots, or garlic. You can also browse the food list above to see what's available.`;
    }

    // Generate response based on found foods
    const responses: string[] = [];

    for (const { food } of mentionedFoods) {
      let response = '';

      if (food.fodmapRating === 'low') {
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

      if (food.alternatives && food.alternatives.length > 0) {
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
            <h3>Food Assistant</h3>
            <p>Ask about any food for SIBO</p>
          </div>

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
