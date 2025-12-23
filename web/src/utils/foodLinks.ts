import type { Food } from '../types/food';

interface FoodMatch {
  pattern: string;
  foodId: string;
  name: string;
}

/**
 * Process text content to convert food names into markdown links.
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
  // Build a list of all food names and aliases with their food IDs
  const foodMatches: FoodMatch[] = [];

  for (const food of foods) {
    // Add the main name
    foodMatches.push({ pattern: food.name, foodId: food.id, name: food.name });

    // Add aliases
    if (food.aliases) {
      for (const alias of food.aliases) {
        foodMatches.push({ pattern: alias, foodId: food.id, name: alias });
      }
    }
  }

  // Sort by length descending to match longer names first (e.g., "Bell Pepper" before "Pepper")
  foodMatches.sort((a, b) => b.pattern.length - a.pattern.length);

  // Track which ranges have been replaced to avoid overlapping matches
  const replacedRanges: { start: number; end: number }[] = [];

  // Find all matches with their positions
  const matches: { start: number; end: number; replacement: string }[] = [];

  for (const { pattern, foodId } of foodMatches) {
    // Escape special regex characters in the pattern
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Determine if pattern starts/ends with a word character for boundary matching
    const startsWithWord = /^\w/.test(pattern);
    const endsWithWord = /\w$/.test(pattern);

    // Build boundary patterns based on whether pattern starts/ends with word chars
    // For word chars, use \b; for non-word chars, use lookahead/behind for space/boundary
    const leftBoundary = startsWithWord ? '\\b' : '(?<=^|[\\s.,;:!?])';
    const rightBoundary = endsWithWord ? '\\b' : '(?=$|[\\s.,;:!?])';

    const regex = new RegExp(`${leftBoundary}${escapedPattern}${rightBoundary}`, 'gi');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Check if this range overlaps with any already replaced range
      const overlaps = replacedRanges.some(
        range => (start >= range.start && start < range.end) ||
                 (end > range.start && end <= range.end) ||
                 (start <= range.start && end >= range.end)
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
