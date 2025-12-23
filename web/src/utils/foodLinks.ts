import type { Food } from '../types/food';

interface FoodPattern {
  foodId: string;
  regex: RegExp;
}

/**
 * Creates a memoized food link processor that pre-computes regex patterns
 * and caches results for efficient repeated processing.
 */
export function createFoodLinkProcessor(
  foods: Pick<Food, 'id' | 'name' | 'aliases'>[]
) {
  // Pre-compute all patterns sorted by length (longer first)
  const patterns: FoodPattern[] = [];

  for (const food of foods) {
    // Add the main name
    patterns.push({
      foodId: food.id,
      regex: createBoundaryRegex(food.name),
    });

    // Add aliases
    if (food.aliases) {
      for (const alias of food.aliases) {
        patterns.push({
          foodId: food.id,
          regex: createBoundaryRegex(alias),
        });
      }
    }
  }

  // Sort by pattern length descending (longer patterns first)
  // We need to extract the source to get length since regex doesn't store original
  patterns.sort((a, b) => {
    const aLen = a.regex.source.length;
    const bLen = b.regex.source.length;
    return bLen - aLen;
  });

  // Simple LRU-like cache for processed content
  const cache = new Map<string, string>();
  const MAX_CACHE_SIZE = 100;

  function processContent(content: string): string {
    // Check cache first
    const cached = cache.get(content);
    if (cached !== undefined) {
      return cached;
    }

    const result = processContentWithPatterns(content, patterns);

    // Add to cache, evicting oldest if needed
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }
    cache.set(content, result);

    return result;
  }

  return { processContent };
}

/**
 * Creates a regex with appropriate word boundaries for a food pattern.
 */
function createBoundaryRegex(pattern: string): RegExp {
  // Escape special regex characters
  const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Determine if pattern starts/ends with a word character for boundary matching
  const startsWithWord = /^\w/.test(pattern);
  const endsWithWord = /\w$/.test(pattern);

  // For word chars, use \b; for non-word chars, use lookahead/behind for space/boundary
  const leftBoundary = startsWithWord ? '\\b' : '(?<=^|[\\s.,;:!?])';
  const rightBoundary = endsWithWord ? '\\b' : '(?=$|[\\s.,;:!?])';

  return new RegExp(`${leftBoundary}${escapedPattern}${rightBoundary}`, 'gi');
}

/**
 * Process content using pre-computed patterns.
 */
function processContentWithPatterns(
  content: string,
  patterns: FoodPattern[]
): string {
  // Track which ranges have been replaced to avoid overlapping matches
  const replacedRanges: { start: number; end: number }[] = [];

  // Find all matches with their positions
  const matches: { start: number; end: number; replacement: string }[] = [];

  for (const { foodId, regex } of patterns) {
    // Reset regex lastIndex for fresh search
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if this range overlaps with any already replaced range
      // Two ranges overlap if one starts before the other ends and vice versa
      const overlaps = replacedRanges.some(
        range => start < range.end && end > range.start
      );

      if (!overlaps) {
        // Check if already inside a markdown link or bold syntax
        const beforeText = content.slice(Math.max(0, start - 50), start);
        const afterText = content.slice(end, Math.min(content.length, end + 10));

        // Skip if inside markdown link [...](...) or inside @food: URL
        const isInsideLinkText = /\[[^\]]*$/.test(beforeText);
        const isFollowedByLinkClose = /^\]/.test(afterText);
        const isInsideFoodUrl = /@food:[a-z0-9-]*$/.test(beforeText);
        const isInsideLink = isInsideLinkText || isFollowedByLinkClose || isInsideFoodUrl;

        if (!isInsideLink) {
          matches.push({
            start,
            end,
            replacement: `[${match[0]}](@food:${foodId})`
          });
          replacedRanges.push({ start, end });
        }
      }
    }
  }

  // Sort matches by position (reverse order for safe replacement)
  matches.sort((a, b) => b.start - a.start);

  // Apply replacements from end to start to preserve positions
  let result = content;
  for (const { start, end, replacement } of matches) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  return result;
}

/**
 * Process text content to convert food names into markdown links.
 *
 * Note: For better performance with repeated calls, use createFoodLinkProcessor()
 * to create a memoized processor that pre-computes patterns.
 *
 * This function:
 * - Finds all food names and aliases in the content
 * - Converts them to markdown links with @food: prefix
 * - Handles longer names before shorter ones (e.g., "Bell Pepper" before "Pepper")
 * - Avoids overlapping matches
 * - Skips food names that are already inside markdown links
 * - Properly escapes special regex characters in food names
 */
export function processContentWithFoodLinks(
  content: string,
  foods: Pick<Food, 'id' | 'name' | 'aliases'>[]
): string {
  // Build patterns on-the-fly (less efficient for repeated calls)
  const patterns: FoodPattern[] = [];

  for (const food of foods) {
    patterns.push({
      foodId: food.id,
      regex: createBoundaryRegex(food.name),
    });

    if (food.aliases) {
      for (const alias of food.aliases) {
        patterns.push({
          foodId: food.id,
          regex: createBoundaryRegex(alias),
        });
      }
    }
  }

  // Sort by regex source length descending
  patterns.sort((a, b) => b.regex.source.length - a.regex.source.length);

  return processContentWithPatterns(content, patterns);
}
