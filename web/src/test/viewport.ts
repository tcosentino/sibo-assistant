/**
 * Viewport utilities for testing responsive components
 *
 * Note: jsdom doesn't fully support CSS media queries or viewport-dependent
 * rendering. These utilities help simulate viewport changes for JavaScript
 * logic that depends on window dimensions, but CSS media queries won't trigger.
 *
 * For true visual viewport testing, use:
 * - Playwright with viewport configuration
 * - Cypress with cy.viewport()
 * - Storybook with viewport addon
 */

export interface ViewportSize {
  width: number;
  height: number;
}

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },    // iPhone SE
  mobileLarge: { width: 414, height: 896 }, // iPhone 11 Pro Max
  tablet: { width: 768, height: 1024 },   // iPad
  desktop: { width: 1280, height: 800 },  // Standard desktop
  desktopLarge: { width: 1920, height: 1080 }, // Full HD
} as const;

/**
 * Sets window.innerWidth and window.innerHeight for testing
 * JavaScript logic that depends on viewport dimensions.
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *   setViewport(VIEWPORTS.mobile);
 * });
 * ```
 */
export function setViewport(size: ViewportSize): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: size.width,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: size.height,
  });

  // Trigger resize event for components that listen
  window.dispatchEvent(new Event('resize'));
}

/**
 * Resets viewport to default desktop size
 */
export function resetViewport(): void {
  setViewport(VIEWPORTS.desktop);
}

/**
 * Helper to check if current viewport is mobile-sized
 * Useful for components with JS-based responsive logic
 */
export function isMobileViewport(): boolean {
  return window.innerWidth < 640;
}

/**
 * Helper to check if current viewport is tablet-sized
 */
export function isTabletViewport(): boolean {
  return window.innerWidth >= 640 && window.innerWidth < 1024;
}

/**
 * Creates a matchMedia mock for testing CSS media query listeners
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *   mockMatchMedia(VIEWPORTS.mobile);
 * });
 * ```
 */
export function mockMatchMedia(viewport: ViewportSize): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      // Parse common media query patterns
      const minWidthMatch = query.match(/\(min-width:\s*(\d+)px\)/);
      const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);

      let matches = false;

      if (minWidthMatch) {
        matches = viewport.width >= parseInt(minWidthMatch[1], 10);
      } else if (maxWidthMatch) {
        matches = viewport.width <= parseInt(maxWidthMatch[1], 10);
      }

      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
}
