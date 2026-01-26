/**
 * InviteForm Component Tests (TDD)
 *
 * Tests for magic link invite generation form:
 * - Email input with client-side validation
 * - Generate Invite button calls API
 * - Generated link display with copy functionality
 * - Error handling for invalid emails and API failures
 *
 * @jest-environment jsdom
 */

/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InviteForm } from '@/web/frontend/components/InviteForm';

// Mock the apiClient module
jest.mock('@/web/frontend/services/apiClient', () => ({
  apiClient: {
    generateInvite: jest.fn(),
  },
}));

// Import the mocked module
import { apiClient } from '@/web/frontend/services/apiClient';
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('InviteForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render email input field', () => {
      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      // @ts-expect-error - jest-dom matchers
      expect(emailInput).toBeInTheDocument();
      // @ts-expect-error - jest-dom matchers
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should render Generate Invite button', () => {
      render(<InviteForm />);

      const button = screen.getByRole('button', { name: /generate invite/i });
      // @ts-expect-error - jest-dom matchers
      expect(button).toBeInTheDocument();
    });

    it('should have proper form structure with accessible labels', () => {
      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      // @ts-expect-error - jest-dom matchers
      expect(emailInput).toBeInTheDocument();
      // @ts-expect-error - jest-dom matchers
      expect(emailInput).toHaveAttribute('placeholder');
    });
  });

  describe('Email Validation', () => {
    it('should show error for empty email on submit', async () => {
      render(<InviteForm />);

      const button = screen.getByRole('button', { name: /generate invite/i });
      fireEvent.click(button);

      await waitFor(() => {
        const error = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(error).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(error).toHaveTextContent(/email.*required|enter.*email/i);
      });
    });

    it('should show error for invalid email format', async () => {
      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      // Use a value that our regex validation rejects (no TLD)
      fireEvent.change(emailInput, { target: { value: 'invalid@nodomain' } });
      fireEvent.click(button);

      await waitFor(() => {
        const error = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(error).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(error).toHaveTextContent(/valid.*email|invalid.*email/i);
      });
    });

    it('should clear error when email is corrected', async () => {
      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      // Trigger validation error (no TLD in domain)
      fireEvent.change(emailInput, { target: { value: 'invalid@nodomain' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Correct the email
      fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });

      // Error should be cleared on input change
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should call generateInvite API with valid email', async () => {
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: 'http://localhost:3000/register?token=abc123',
        email: 'newuser@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockApiClient.generateInvite).toHaveBeenCalledWith('newuser@example.com');
      });
    });

    it('should show loading state while generating invite', async () => {
      // Never resolve to observe loading state
      mockApiClient.generateInvite.mockImplementation(() => new Promise(() => {}));

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeDisabled();
        // Check for loading indicator (spinner or text)
        expect(screen.getByText(/generating|loading/i)).toBeInTheDocument();
      });
    });

    it('should disable form inputs while loading', async () => {
      mockApiClient.generateInvite.mockImplementation(() => new Promise(() => {}));

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(emailInput).toBeDisabled();
        // @ts-expect-error - jest-dom matchers
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Success State', () => {
    it('should display generated link after successful API call', async () => {
      const mockLink = 'http://localhost:3000/register?token=abc123def456';
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: mockLink,
        email: 'newuser@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(mockLink)).toBeInTheDocument();
      });
    });

    it('should show copy button for generated link', async () => {
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: 'http://localhost:3000/register?token=abc123',
        email: 'user@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        const copyButton = screen.getByRole('button', { name: /copy/i });
        // @ts-expect-error - jest-dom matchers
        expect(copyButton).toBeInTheDocument();
      });
    });

    it('should copy link to clipboard when copy button is clicked', async () => {
      const mockLink = 'http://localhost:3000/register?token=abc123';
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: mockLink,
        email: 'user@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // Mock clipboard API
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const generateButton = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(mockLink)).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(mockLink);
      });
    });

    it('should show expiration time for the generated link', async () => {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: 'http://localhost:3000/register?token=abc123',
        email: 'user@example.com',
        expiresAt,
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/expires|valid/i)).toBeInTheDocument();
      });
    });

    it('should allow generating another invite after success', async () => {
      mockApiClient.generateInvite.mockResolvedValue({
        success: true,
        link: 'http://localhost:3000/register?token=abc123',
        email: 'user@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/register\?token/)).toBeInTheDocument();
      });

      // Should have a way to generate another invite
      const newInviteButton = screen.getByRole('button', {
        name: /generate.*another|new.*invite/i,
      });
      // @ts-expect-error - jest-dom matchers
      expect(newInviteButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      mockApiClient.generateInvite.mockRejectedValue(new Error('API Error: Server error'));

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        const error = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(error).toBeInTheDocument();
        // @ts-expect-error - jest-dom matchers
        expect(error).toHaveTextContent(/error|failed/i);
      });
    });

    it('should re-enable form after API error', async () => {
      mockApiClient.generateInvite.mockRejectedValue(new Error('API Error'));

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        // @ts-expect-error - jest-dom matchers
        expect(emailInput).not.toBeDisabled();
        // @ts-expect-error - jest-dom matchers
        expect(button).not.toBeDisabled();
      });
    });

    it('should display specific error for duplicate email', async () => {
      mockApiClient.generateInvite.mockRejectedValue(
        new Error('API Error (409): Email already has a pending invite')
      );

      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      const button = screen.getByRole('button', { name: /generate invite/i });

      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.click(button);

      await waitFor(() => {
        const error = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(error).toHaveTextContent(/pending invite|already/i);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria attributes on form elements', () => {
      render(<InviteForm />);

      const emailInput = screen.getByLabelText(/email/i);
      // @ts-expect-error - jest-dom matchers
      expect(emailInput).toHaveAttribute('aria-required', 'true');
    });

    it('should announce errors to screen readers', async () => {
      render(<InviteForm />);

      const button = screen.getByRole('button', { name: /generate invite/i });
      fireEvent.click(button);

      await waitFor(() => {
        const error = screen.getByRole('alert');
        // @ts-expect-error - jest-dom matchers
        expect(error).toBeInTheDocument();
      });
    });

    it('should have proper heading structure', () => {
      render(<InviteForm />);

      // Should have a section heading
      const heading = screen.getByRole('heading', { name: /registration invite/i });
      expect(heading).toBeInTheDocument();
    });
  });
});
