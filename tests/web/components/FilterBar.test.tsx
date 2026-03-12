/**
 * FilterBar Component Tests
 *
 * Tests for the reusable FilterBar component with:
 * - Provider, model, and generator dropdown filters
 * - Debounced search input (300ms)
 * - Sort dropdown (Newest first / Oldest first)
 * - Dynamic option lists populated by parent
 * - Responsive layout
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { FilterBar, type FilterBarProps } from '@/web/frontend/components/FilterBar';

describe('FilterBar Component', () => {
  const defaultProps: FilterBarProps = {
    providers: ['openai', 'anthropic'],
    models: ['gpt-4.1-nano', 'claude-haiku-4.5'],
    generators: ['haiku', 'news-summary', 'weather-focus'],
    selectedProvider: '',
    selectedModel: '',
    selectedGenerator: '',
    searchQuery: '',
    sortOrder: 'newest',
    onProviderChange: jest.fn(),
    onModelChange: jest.fn(),
    onGeneratorChange: jest.fn(),
    onSearchChange: jest.fn(),
    onSortChange: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    (defaultProps.onProviderChange as jest.Mock).mockClear();
    (defaultProps.onModelChange as jest.Mock).mockClear();
    (defaultProps.onGeneratorChange as jest.Mock).mockClear();
    (defaultProps.onSearchChange as jest.Mock).mockClear();
    (defaultProps.onSortChange as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders search input with placeholder text', () => {
      render(<FilterBar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      // @ts-expect-error - jest-dom matchers
      expect(searchInput).toBeInTheDocument();
    });

    it('renders provider filter dropdown', () => {
      render(<FilterBar {...defaultProps} />);

      const providerTrigger = screen.getByRole('combobox', { name: /provider/i });
      // @ts-expect-error - jest-dom matchers
      expect(providerTrigger).toBeInTheDocument();
    });

    it('renders model filter dropdown', () => {
      render(<FilterBar {...defaultProps} />);

      const modelTrigger = screen.getByRole('combobox', { name: /model/i });
      // @ts-expect-error - jest-dom matchers
      expect(modelTrigger).toBeInTheDocument();
    });

    it('renders generator filter dropdown', () => {
      render(<FilterBar {...defaultProps} />);

      const generatorTrigger = screen.getByRole('combobox', { name: /generator/i });
      // @ts-expect-error - jest-dom matchers
      expect(generatorTrigger).toBeInTheDocument();
    });

    it('renders sort dropdown with default "Newest first"', () => {
      render(<FilterBar {...defaultProps} />);

      const sortTrigger = screen.getByRole('combobox', { name: /sort/i });
      // @ts-expect-error - jest-dom matchers
      expect(sortTrigger).toBeInTheDocument();
      expect(sortTrigger.textContent).toMatch(/newest first/i);
    });
  });

  describe('Search Input with Debounce', () => {
    it('does not fire onSearchChange immediately on typing', () => {
      render(<FilterBar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'hello' } });

      expect(defaultProps.onSearchChange).not.toHaveBeenCalled();
    });

    it('fires onSearchChange after 300ms debounce', () => {
      render(<FilterBar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'hello' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(defaultProps.onSearchChange).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('hello');
    });

    it('debounces multiple rapid keystrokes into a single callback', () => {
      render(<FilterBar {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      fireEvent.change(searchInput, { target: { value: 'h' } });
      act(() => {
        jest.advanceTimersByTime(100);
      });
      fireEvent.change(searchInput, { target: { value: 'he' } });
      act(() => {
        jest.advanceTimersByTime(100);
      });
      fireEvent.change(searchInput, { target: { value: 'hel' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(defaultProps.onSearchChange).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('hel');
    });

    it('shows a clear button when search has text', () => {
      render(<FilterBar {...defaultProps} searchQuery="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      // @ts-expect-error - jest-dom matchers
      expect(clearButton).toBeInTheDocument();
    });

    it('clears the search input and fires callback immediately when clear is clicked', () => {
      render(<FilterBar {...defaultProps} searchQuery="test" />);

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      fireEvent.click(clearButton);

      expect(defaultProps.onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('Filter Dropdowns', () => {
    it('shows "All" as default option text when no filter is selected', () => {
      render(<FilterBar {...defaultProps} />);

      const providerTrigger = screen.getByRole('combobox', { name: /provider/i });
      expect(providerTrigger.textContent).toMatch(/all/i);
    });

    it('displays selected provider value in the trigger', () => {
      render(<FilterBar {...defaultProps} selectedProvider="openai" />);

      const providerTrigger = screen.getByRole('combobox', { name: /provider/i });
      expect(providerTrigger.textContent).toMatch(/openai/i);
    });

    it('displays selected model value in the trigger', () => {
      render(<FilterBar {...defaultProps} selectedModel="gpt-4.1-nano" />);

      const modelTrigger = screen.getByRole('combobox', { name: /model/i });
      expect(modelTrigger.textContent).toMatch(/gpt-4\.1-nano/i);
    });

    it('displays selected generator value in the trigger', () => {
      render(<FilterBar {...defaultProps} selectedGenerator="haiku" />);

      const generatorTrigger = screen.getByRole('combobox', { name: /generator/i });
      expect(generatorTrigger.textContent).toMatch(/haiku/i);
    });
  });

  describe('Sort Dropdown', () => {
    it('displays "Newest first" when sortOrder is "newest"', () => {
      render(<FilterBar {...defaultProps} sortOrder="newest" />);

      const sortTrigger = screen.getByRole('combobox', { name: /sort/i });
      expect(sortTrigger.textContent).toMatch(/newest first/i);
    });

    it('displays "Oldest first" when sortOrder is "oldest"', () => {
      render(<FilterBar {...defaultProps} sortOrder="oldest" />);

      const sortTrigger = screen.getByRole('combobox', { name: /sort/i });
      expect(sortTrigger.textContent).toMatch(/oldest first/i);
    });
  });

  describe('Empty Option Lists', () => {
    it('renders disabled provider dropdown when no providers are available', () => {
      render(<FilterBar {...defaultProps} providers={[]} />);

      const providerTrigger = screen.getByRole('combobox', { name: /provider/i });
      // @ts-expect-error - jest-dom matchers
      expect(providerTrigger).toBeDisabled();
    });

    it('renders disabled model dropdown when no models are available', () => {
      render(<FilterBar {...defaultProps} models={[]} />);

      const modelTrigger = screen.getByRole('combobox', { name: /model/i });
      // @ts-expect-error - jest-dom matchers
      expect(modelTrigger).toBeDisabled();
    });

    it('renders disabled generator dropdown when no generators are available', () => {
      render(<FilterBar {...defaultProps} generators={[]} />);

      const generatorTrigger = screen.getByRole('combobox', { name: /generator/i });
      // @ts-expect-error - jest-dom matchers
      expect(generatorTrigger).toBeDisabled();
    });
  });

  describe('Responsive Layout', () => {
    it('uses a flex container with wrap for responsive layout', () => {
      const { container } = render(<FilterBar {...defaultProps} />);

      const wrapper = container.firstElementChild;
      expect(wrapper?.className).toMatch(/flex/);
      expect(wrapper?.className).toMatch(/flex-wrap|flex-col/);
    });
  });
});
