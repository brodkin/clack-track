/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import App from '@/web/frontend/App';

describe('App Component', () => {
  it('renders Clack Track branding', () => {
    render(<App />);

    const heading = screen.getByRole('heading', { name: /clack track/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('displays debug interface label', () => {
    render(<App />);

    const debugLabel = screen.getByText(/debug interface/i);
    // @ts-expect-error - jest-dom matchers
    expect(debugLabel).toBeInTheDocument();
  });

  it('shows technology stack', () => {
    render(<App />);

    const techStack = screen.getByText(/react \+ typescript \+ vite/i);
    // @ts-expect-error - jest-dom matchers
    expect(techStack).toBeInTheDocument();
  });
});
