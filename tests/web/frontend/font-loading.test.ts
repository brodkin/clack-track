/**
 * Font Loading Tests
 *
 * Tests that custom fonts are properly configured and available.
 * Validates font configuration in index.html, index.css, and tailwind.config.ts
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Font Loading Infrastructure', () => {
  const basePath = resolve(__dirname, '../../../src/web/frontend');
  const indexHtml = readFileSync(resolve(basePath, 'index.html'), 'utf-8');
  const indexCss = readFileSync(resolve(basePath, 'index.css'), 'utf-8');
  const tailwindConfig = readFileSync(resolve(__dirname, '../../../tailwind.config.ts'), 'utf-8');

  describe('HTML Font Link Tags', () => {
    it('should include Google Fonts preconnect link', () => {
      expect(indexHtml).toContain('rel="preconnect"');
      expect(indexHtml).toContain('https://fonts.googleapis.com');
    });

    it('should include Google Fonts DNS prefetch for gstatic', () => {
      expect(indexHtml).toContain('rel="dns-prefetch"');
      expect(indexHtml).toContain('https://fonts.gstatic.com');
    });

    it('should load brush script font (Pacifico)', () => {
      expect(indexHtml).toContain('Pacifico');
      expect(indexHtml).toContain('fonts.googleapis.com');
    });

    it('should load modern sans-serif font (Bebas Neue)', () => {
      expect(indexHtml).toContain('Bebas+Neue');
      expect(indexHtml).toContain('fonts.googleapis.com');
    });

    it('should use font-display=swap for optimal loading', () => {
      const hasSwap = indexHtml.includes('display=swap');
      expect(hasSwap).toBe(true);
    });

    it('should use crossorigin attribute for preconnect', () => {
      const hasPreconnectWithCrossorigin =
        indexHtml.includes('rel="preconnect"') && indexHtml.includes('crossorigin');
      expect(hasPreconnectWithCrossorigin).toBe(true);
    });

    it('should keep font links in head section', () => {
      const headStart = indexHtml.indexOf('<head>');
      const headEnd = indexHtml.indexOf('</head>');
      const fontLinkIndex = indexHtml.indexOf('fonts.googleapis.com');

      expect(headStart).toBeGreaterThan(-1);
      expect(headEnd).toBeGreaterThan(-1);
      expect(fontLinkIndex).toBeGreaterThan(headStart);
      expect(fontLinkIndex).toBeLessThan(headEnd);
    });

    it('should prioritize font loading before main script', () => {
      const fontLinkIndex = indexHtml.indexOf('fonts.googleapis.com');
      const scriptIndex = indexHtml.indexOf('type="module"');

      expect(fontLinkIndex).toBeGreaterThan(-1);
      expect(scriptIndex).toBeGreaterThan(-1);
      expect(fontLinkIndex).toBeLessThan(scriptIndex);
    });
  });

  describe('Tailwind Configuration', () => {
    it('should define brush script font family', () => {
      expect(tailwindConfig).toContain('brush');
      expect(tailwindConfig).toContain('Pacifico');
    });

    it('should define display sans-serif font family', () => {
      expect(tailwindConfig).toContain('display');
      expect(tailwindConfig).toContain('Bebas Neue');
    });

    it('should include fallback fonts for brush font', () => {
      expect(tailwindConfig).toContain('brush');
      expect(tailwindConfig).toContain('cursive');
    });

    it('should include fallback fonts for display font', () => {
      expect(tailwindConfig).toContain('display');
      expect(tailwindConfig).toContain('sans-serif');
    });

    it('should extend default font families not replace them', () => {
      expect(tailwindConfig).toContain('sans:');
      expect(tailwindConfig).toContain('Inter');
      expect(tailwindConfig).toContain('mono:');
    });
  });

  describe('CSS Font Variables', () => {
    it('should define font-brush CSS custom property', () => {
      expect(indexCss).toContain('--font-brush');
    });

    it('should define font-display CSS custom property', () => {
      expect(indexCss).toContain('--font-display');
    });

    it('should set brush font with Pacifico', () => {
      expect(indexCss).toContain('--font-brush');
      expect(indexCss).toContain('Pacifico');
    });

    it('should set display font with Bebas Neue', () => {
      expect(indexCss).toContain('--font-display');
      expect(indexCss).toContain('Bebas Neue');
    });

    it('should include fallback fonts in CSS variables', () => {
      expect(indexCss).toContain('--font-brush');
      expect(indexCss).toContain('cursive');
      expect(indexCss).toContain('--font-display');
      expect(indexCss).toContain('sans-serif');
    });

    it('should define font variables in root selector', () => {
      const rootStart = indexCss.indexOf(':root');
      const brushVarIndex = indexCss.indexOf('--font-brush');
      const displayVarIndex = indexCss.indexOf('--font-display');

      expect(rootStart).toBeGreaterThan(-1);
      expect(brushVarIndex).toBeGreaterThan(rootStart);
      expect(displayVarIndex).toBeGreaterThan(rootStart);
    });
  });

  describe('Font Configuration Completeness', () => {
    it('should have matching font definitions across all config files', () => {
      const fonts = ['Pacifico', 'Bebas'];

      fonts.forEach(font => {
        expect(indexHtml).toContain(font);
        expect(indexCss).toContain(font);
        expect(tailwindConfig).toContain(font);
      });
    });

    it('should define custom font families in Tailwind', () => {
      const hasBrush = tailwindConfig.includes('brush:');
      const hasDisplay = tailwindConfig.includes('display:');

      expect(hasBrush).toBe(true);
      expect(hasDisplay).toBe(true);
    });

    it('should provide consistent naming convention', () => {
      // CSS variables use --font-X format
      expect(indexCss).toContain('--font-brush');
      expect(indexCss).toContain('--font-display');

      // Tailwind uses X: format
      expect(tailwindConfig).toContain('brush:');
      expect(tailwindConfig).toContain('display:');
    });
  });

  describe('Performance Optimizations', () => {
    it('should use preconnect for fonts.googleapis.com', () => {
      const hasPreconnect =
        indexHtml.includes('rel="preconnect"') && indexHtml.includes('fonts.googleapis.com');
      expect(hasPreconnect).toBe(true);
    });

    it('should use dns-prefetch for fonts.gstatic.com', () => {
      const hasDnsPrefetch =
        indexHtml.includes('rel="dns-prefetch"') && indexHtml.includes('fonts.gstatic.com');
      expect(hasDnsPrefetch).toBe(true);
    });

    it('should use font-display swap strategy', () => {
      expect(indexHtml).toContain('display=swap');
    });

    it('should use crossorigin for preconnect', () => {
      expect(indexHtml).toContain('crossorigin');
    });
  });
});
