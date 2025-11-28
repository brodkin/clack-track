/// <reference types="@testing-library/jest-dom" />
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from '@jest/globals';
import App from '@/web/frontend/App';

describe('App Component', () => {
  it('renders Welcome page on default route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /latest content/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders navigation with Clack Track branding', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    const brand = screen.getByText(/clack track/i);
    // @ts-expect-error - jest-dom matchers
    expect(brand).toBeInTheDocument();
  });

  it('renders History page on /flipside route', () => {
    render(
      <MemoryRouter initialEntries={['/flipside']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /the flip side/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders Account page on /account route', () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <App />
      </MemoryRouter>
    );

    const heading = screen.getByRole('heading', { name: /account/i });
    // @ts-expect-error - jest-dom matchers
    expect(heading).toBeInTheDocument();
  });

  it('renders Login page on /login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    const button = screen.getByRole('button', { name: /sign in with passkey/i });
    // @ts-expect-error - jest-dom matchers
    expect(button).toBeInTheDocument();
  });
});
