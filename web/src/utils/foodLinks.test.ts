import { describe, it, expect } from 'vitest';
import { processContentWithFoodLinks, createFoodLinkProcessor } from './foodLinks';

describe('processContentWithFoodLinks', () => {
  describe('basic food name detection and linking', () => {
    it('should convert a single food name to a link', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'You can eat Carrot safely.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('You can eat [Carrot](@food:carrot) safely.');
    });

    it('should convert multiple different food names to links', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];
      const content = 'Carrot and Spinach are both safe.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) and [Spinach](@food:spinach) are both safe.');
    });

    it('should convert multiple occurrences of the same food name', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'Carrot is great. I love Carrot.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) is great. I love [Carrot](@food:carrot).');
    });

    it('should handle case-insensitive matching', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'You can eat CARROT or carrot or CaRrOt.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('You can eat [CARROT](@food:carrot) or [carrot](@food:carrot) or [CaRrOt](@food:carrot).');
    });

    it('should preserve the original case of matched text in the link', () => {
      const foods = [{ id: 'bell-pepper', name: 'Bell Pepper' }];
      const content = 'Try some bell pepper today.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try some [bell pepper](@food:bell-pepper) today.');
    });

    it('should not match partial words', () => {
      const foods = [{ id: 'car', name: 'Car' }];
      const content = 'Carrot is not a Car.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Carrot is not a [Car](@food:car).');
    });

    it('should return content unchanged when no foods match', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'There is no matching food here.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('There is no matching food here.');
    });

    it('should return content unchanged when foods array is empty', () => {
      const content = 'Some text about Carrot.';

      const result = processContentWithFoodLinks(content, []);

      expect(result).toBe('Some text about Carrot.');
    });
  });

  describe('longer names preferred over shorter ones', () => {
    it('should prefer "Bell Pepper" over "Pepper"', () => {
      const foods = [
        { id: 'pepper', name: 'Pepper' },
        { id: 'bell-pepper', name: 'Bell Pepper' },
      ];
      const content = 'Bell Pepper is a type of Pepper.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Bell Pepper](@food:bell-pepper) is a type of [Pepper](@food:pepper).');
    });

    it('should prefer "Green Bell Pepper" over "Bell Pepper" over "Pepper"', () => {
      const foods = [
        { id: 'pepper', name: 'Pepper' },
        { id: 'bell-pepper', name: 'Bell Pepper' },
        { id: 'green-bell-pepper', name: 'Green Bell Pepper' },
      ];
      const content = 'I ate a Green Bell Pepper.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('I ate a [Green Bell Pepper](@food:green-bell-pepper).');
    });

    it('should handle order independence in foods array', () => {
      // Same test but foods provided in different order
      const foods = [
        { id: 'green-bell-pepper', name: 'Green Bell Pepper' },
        { id: 'pepper', name: 'Pepper' },
        { id: 'bell-pepper', name: 'Bell Pepper' },
      ];
      const content = 'I ate a Green Bell Pepper.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('I ate a [Green Bell Pepper](@food:green-bell-pepper).');
    });

    it('should prefer "Cow Milk" over "Milk"', () => {
      const foods = [
        { id: 'milk', name: 'Milk' },
        { id: 'cow-milk', name: 'Cow Milk' },
      ];
      const content = 'Cow Milk is one type of Milk.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Cow Milk](@food:cow-milk) is one type of [Milk](@food:milk).');
    });
  });

  describe('alias matching', () => {
    it('should match food aliases', () => {
      const foods = [
        { id: 'garlic', name: 'Garlic', aliases: ['raw garlic'] },
      ];
      const content = 'Avoid raw garlic.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Avoid [raw garlic](@food:garlic).');
    });

    it('should match both name and aliases for the same food', () => {
      const foods = [
        { id: 'milk', name: 'Milk', aliases: ['cow milk', 'whole milk'] },
      ];
      const content = 'Milk, cow milk, and whole milk are all dairy.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Milk](@food:milk), [cow milk](@food:milk), and [whole milk](@food:milk) are all dairy.');
    });

    it('should prefer longer aliases over shorter names', () => {
      const foods = [
        { id: 'garlic', name: 'Garlic', aliases: ['fresh garlic', 'raw garlic'] },
      ];
      const content = 'Use fresh garlic, not just Garlic powder.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Use [fresh garlic](@food:garlic), not just [Garlic](@food:garlic) powder.');
    });

    it('should handle foods without aliases', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'garlic', name: 'Garlic', aliases: ['raw garlic'] },
      ];
      const content = 'Carrot is safe but raw garlic is not.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) is safe but [raw garlic](@food:garlic) is not.');
    });
  });

  describe('overlapping match handling', () => {
    it('should not create overlapping links for substring matches', () => {
      const foods = [
        { id: 'bell-pepper', name: 'Bell Pepper' },
        { id: 'pepper', name: 'Pepper' },
      ];
      const content = 'Bell Pepper is delicious.';

      const result = processContentWithFoodLinks(content, foods);

      // "Bell Pepper" should be matched, and "Pepper" within it should NOT be re-matched
      expect(result).toBe('[Bell Pepper](@food:bell-pepper) is delicious.');
      expect(result).not.toContain('[@food:pepper]');
    });

    it('should handle adjacent food names correctly', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];
      const content = 'Carrot Spinach salad';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) [Spinach](@food:spinach) salad');
    });

    it('should handle nested potential matches', () => {
      const foods = [
        { id: 'oil', name: 'Oil' },
        { id: 'garlic-oil', name: 'Garlic Oil' },
        { id: 'garlic-infused-oil', name: 'Garlic Infused Oil' },
      ];
      const content = 'Use Garlic Infused Oil instead of regular Oil.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Use [Garlic Infused Oil](@food:garlic-infused-oil) instead of regular [Oil](@food:oil).');
    });
  });

  describe('existing markdown links not re-linked', () => {
    it('should not re-link food names already in markdown links', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'Check out [Carrot](https://example.com) for more info.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Check out [Carrot](https://example.com) for more info.');
    });

    it('should not re-link food names already in food links', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'You can eat [Carrot](@food:carrot) safely.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('You can eat [Carrot](@food:carrot) safely.');
    });

    it('should still link food names outside of existing links', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];
      const content = '[Carrot](https://example.com) is good, and so is Spinach.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](https://example.com) is good, and so is [Spinach](@food:spinach).');
    });

    it('should handle multiple existing links correctly', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
        { id: 'kale', name: 'Kale' },
      ];
      const content = '[Carrot](url1) and [Spinach](url2) are linked, but Kale is not.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](url1) and [Spinach](url2) are linked, but [Kale](@food:kale) is not.');
    });

    it('should handle food name appearing both inside and outside links', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'I love [Carrot](url). Carrot is my favorite.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('I love [Carrot](url). [Carrot](@food:carrot) is my favorite.');
    });

    it('should link food names after standalone brackets in normal text', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'The values [shown here] include Carrot.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('The values [shown here] include [Carrot](@food:carrot).');
    });

    it('should link food names before standalone brackets', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'Carrot is good [according to studies].';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) is good [according to studies].');
    });
  });

  describe('regex escaping for special characters', () => {
    it('should handle food names with parentheses', () => {
      const foods = [{ id: 'cheese', name: 'Cheese (aged)' }];
      const content = 'Try Cheese (aged) for low FODMAP.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [Cheese (aged)](@food:cheese) for low FODMAP.');
    });

    it('should handle food names with dots', () => {
      const foods = [{ id: 'dr-pepper', name: 'Dr. Pepper' }];
      const content = 'Is Dr. Pepper okay?';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Is [Dr. Pepper](@food:dr-pepper) okay?');
    });

    it('should handle food names with plus signs', () => {
      const foods = [{ id: 'c-plus', name: 'C+' }];
      const content = 'What about C+ drink?';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('What about [C+](@food:c-plus) drink?');
    });

    it('should handle food names with asterisks', () => {
      const foods = [{ id: 'special-blend', name: 'Special*Blend' }];
      const content = 'Try Special*Blend today.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [Special*Blend](@food:special-blend) today.');
    });

    it('should handle food names with question marks', () => {
      const foods = [{ id: 'whats-up', name: "What's Up?" }];
      const content = "Try What's Up? soda.";

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe("Try [What's Up?](@food:whats-up) soda.");
    });

    it('should handle food names with square brackets', () => {
      const foods = [{ id: 'brand', name: '[Brand] Food' }];
      const content = 'Try [Brand] Food.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [[Brand] Food](@food:brand).');
    });

    it('should handle food names with backslashes', () => {
      const foods = [{ id: 'test', name: 'Test\\Food' }];
      const content = 'Try Test\\Food today.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [Test\\Food](@food:test) today.');
    });

    it('should handle food names with pipe characters', () => {
      const foods = [{ id: 'choice', name: 'A|B Choice' }];
      const content = 'Try A|B Choice.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [A|B Choice](@food:choice).');
    });

    it('should handle food names with caret', () => {
      const foods = [{ id: 'power', name: 'Power^Up' }];
      const content = 'Drink Power^Up.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Drink [Power^Up](@food:power).');
    });

    it('should handle food names with dollar sign', () => {
      const foods = [{ id: 'money', name: '$ave Mart' }];
      const content = 'Shop at $ave Mart.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Shop at [$ave Mart](@food:money).');
    });

    it('should handle combination of special characters', () => {
      const foods = [{ id: 'complex', name: 'Food (v2.0) [Special*Edition]' }];
      const content = 'Try Food (v2.0) [Special*Edition] now.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try [Food (v2.0) [Special*Edition]](@food:complex) now.');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];

      const result = processContentWithFoodLinks('', foods);

      expect(result).toBe('');
    });

    it('should handle content with only whitespace', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];

      const result = processContentWithFoodLinks('   \n\t  ', foods);

      expect(result).toBe('   \n\t  ');
    });

    it('should handle food name at the start of content', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'Carrot is healthy.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot) is healthy.');
    });

    it('should handle food name at the end of content', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'I love Carrot';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('I love [Carrot](@food:carrot)');
    });

    it('should handle content that is just a food name', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'Carrot';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('[Carrot](@food:carrot)');
    });

    it('should handle multi-line content', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];
      const content = `Here is a list:
- Carrot is safe
- Spinach is also safe`;

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe(`Here is a list:
- [Carrot](@food:carrot) is safe
- [Spinach](@food:spinach) is also safe`);
    });

    it('should handle food names with hyphens', () => {
      const foods = [{ id: 'bok-choy', name: 'Bok-Choy' }];
      const content = 'Try some Bok-Choy.';

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe('Try some [Bok-Choy](@food:bok-choy).');
    });

    it('should handle food names with apostrophes', () => {
      const foods = [{ id: 'st-johns', name: "St. John's Wort" }];
      const content = "Avoid St. John's Wort.";

      const result = processContentWithFoodLinks(content, foods);

      expect(result).toBe("Avoid [St. John's Wort](@food:st-johns).");
    });
  });
});

describe('createFoodLinkProcessor', () => {
  describe('basic functionality', () => {
    it('should process content the same as processContentWithFoodLinks', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];
      const content = 'Carrot and Spinach are both safe.';

      const processor = createFoodLinkProcessor(foods);
      const memoizedResult = processor.processContent(content);
      const directResult = processContentWithFoodLinks(content, foods);

      expect(memoizedResult).toBe(directResult);
    });

    it('should handle aliases correctly', () => {
      const foods = [
        { id: 'milk', name: 'Milk', aliases: ['cow milk', 'whole milk'] },
      ];
      const content = 'Milk, cow milk, and whole milk are all dairy.';

      const processor = createFoodLinkProcessor(foods);
      const result = processor.processContent(content);

      expect(result).toBe('[Milk](@food:milk), [cow milk](@food:milk), and [whole milk](@food:milk) are all dairy.');
    });

    it('should prefer longer names over shorter ones', () => {
      const foods = [
        { id: 'pepper', name: 'Pepper' },
        { id: 'bell-pepper', name: 'Bell Pepper' },
      ];
      const content = 'Bell Pepper is a type of Pepper.';

      const processor = createFoodLinkProcessor(foods);
      const result = processor.processContent(content);

      expect(result).toBe('[Bell Pepper](@food:bell-pepper) is a type of [Pepper](@food:pepper).');
    });
  });

  describe('caching behavior', () => {
    it('should return cached results for identical content', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const content = 'I love Carrot.';

      const processor = createFoodLinkProcessor(foods);

      const result1 = processor.processContent(content);
      const result2 = processor.processContent(content);

      expect(result1).toBe(result2);
      expect(result1).toBe('I love [Carrot](@food:carrot).');
    });

    it('should process different content independently', () => {
      const foods = [
        { id: 'carrot', name: 'Carrot' },
        { id: 'spinach', name: 'Spinach' },
      ];

      const processor = createFoodLinkProcessor(foods);

      const result1 = processor.processContent('Carrot is great.');
      const result2 = processor.processContent('Spinach is healthy.');

      expect(result1).toBe('[Carrot](@food:carrot) is great.');
      expect(result2).toBe('[Spinach](@food:spinach) is healthy.');
    });

    it('should handle many different contents without errors', () => {
      const foods = [{ id: 'carrot', name: 'Carrot' }];
      const processor = createFoodLinkProcessor(foods);

      // Process more items than cache size to test eviction
      for (let i = 0; i < 150; i++) {
        const content = `Message ${i} about Carrot.`;
        const result = processor.processContent(content);
        expect(result).toBe(`Message ${i} about [Carrot](@food:carrot).`);
      }
    });
  });

  describe('pattern pre-computation', () => {
    it('should work with a large number of foods', () => {
      const foods = Array.from({ length: 100 }, (_, i) => ({
        id: `food-${i}`,
        name: `Food ${i}`,
      }));

      const processor = createFoodLinkProcessor(foods);
      const result = processor.processContent('I ate Food 50 today.');

      expect(result).toBe('I ate [Food 50](@food:food-50) today.');
    });

    it('should work with foods that have many aliases', () => {
      const foods = [
        {
          id: 'milk',
          name: 'Milk',
          aliases: ['cow milk', 'whole milk', 'dairy milk', '2% milk', 'skim milk'],
        },
      ];

      const processor = createFoodLinkProcessor(foods);

      expect(processor.processContent('Drink Milk.')).toBe('Drink [Milk](@food:milk).');
      expect(processor.processContent('Try cow milk.')).toBe('Try [cow milk](@food:milk).');
      expect(processor.processContent('Use skim milk.')).toBe('Use [skim milk](@food:milk).');
    });
  });
});
