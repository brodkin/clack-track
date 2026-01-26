/**
 * InviteForm Component
 *
 * Form for generating magic link invites for user registration.
 * Admin-only functionality that calls POST /api/admin/invite.
 *
 * Features:
 * - Email input with client-side validation
 * - Loading state while generating invite
 * - Success state with copyable link display
 * - Error handling for API failures
 *
 * Architecture:
 * - Single Responsibility: Handles invite generation UI only
 * - Dependency Inversion: Uses apiClient abstraction for API calls
 * - Open/Closed: Extensible via props without modification
 */

import { useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Copy, Check, Mail, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/apiClient.js';

/**
 * Email validation regex
 * Validates standard email format: local@domain.tld
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Result from successful invite generation
 */
interface InviteResult {
  link: string;
  email: string;
  expiresAt: string;
}

/**
 * InviteForm Component
 *
 * Renders a form to generate magic link invites for new users.
 * Requires the user to be authenticated (enforced by ProtectedRoute wrapper).
 */
export function InviteForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Validate email format
   */
  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return 'Email is required';
    }
    if (!EMAIL_REGEX.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  }, []);

  /**
   * Handle email input change
   * Clears any existing error when user types
   */
  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError(null);
  }, []);

  /**
   * Handle form submission
   * Validates email and calls API to generate invite
   */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      // Client-side validation
      const validationError = validateEmail(email);
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.generateInvite(email);
        setResult({
          link: response.link,
          email: response.email,
          expiresAt: response.expiresAt,
        });
        setEmail('');
      } catch (err) {
        const error = err as Error;
        // Extract user-friendly message from API error
        const message = error.message || 'Failed to generate invite';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [email, validateEmail]
  );

  /**
   * Handle copy link to clipboard
   */
  const handleCopy = useCallback(async () => {
    if (!result?.link) return;

    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      setError('Failed to copy to clipboard');
    }
  }, [result?.link]);

  /**
   * Handle generating another invite
   */
  const handleNewInvite = useCallback(() => {
    setResult(null);
    setError(null);
    setCopied(false);
  }, []);

  /**
   * Format expiration time for display
   */
  const formatExpiration = useCallback((expiresAt: string): string => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 24) {
      return `Expires in ${diffHours} hours`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `Valid for ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }, []);

  // Success state - show generated link
  if (result) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Generated</h3>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Invite sent for: {result.email}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded border border-gray-200 dark:border-gray-700 text-sm break-all">
              {result.link}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex items-center gap-2"
              aria-label={copied ? 'Copied' : 'Copy link'}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-green-700 dark:text-green-300">
            {formatExpiration(result.expiresAt)}
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={handleNewInvite} className="w-full">
          Generate Another Invite
        </Button>
      </div>
    );
  }

  // Form state
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Registration Invite</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="invite-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Email Address
          </label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="newuser@example.com"
            disabled={isLoading}
            aria-required="true"
            aria-invalid={!!error}
            aria-describedby={error ? 'invite-error' : undefined}
          />
        </div>

        {/* Error message */}
        {error && (
          <div
            id="invite-error"
            role="alert"
            className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Generating...' : 'Generate Invite'}
        </Button>
      </form>
    </div>
  );
}

export default InviteForm;
