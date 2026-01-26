/**
 * Register Page (/register?token=xxx)
 *
 * User registration via magic link token with passkey setup.
 * Handles registration flow: token validation -> name entry -> passkey setup -> account creation
 *
 * Architecture:
 * - Single Responsibility: Manages only registration UI and flow
 * - Dependency Inversion: Uses apiClient abstraction
 * - Open/Closed: Extensible via additional registration methods
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { PageLayout } from '../components/PageLayout.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { UserPlus, AlertCircle, Shield, Mail, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiClient } from '../services/apiClient.js';

/**
 * Check if browser supports WebAuthn passkeys
 * In test environment, returns true unless PublicKeyCredential is explicitly undefined
 */
function isPasskeySupported(): boolean {
  // Check for test environment where we want to simulate support
  if (
    typeof (globalThis as { __TEST_PASSKEY_SUPPORT__?: boolean }).__TEST_PASSKEY_SUPPORT__ !==
    'undefined'
  ) {
    return (globalThis as { __TEST_PASSKEY_SUPPORT__?: boolean }).__TEST_PASSKEY_SUPPORT__ ?? false;
  }

  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined'
  );
}

/**
 * Token validation state
 */
interface TokenState {
  isValid: boolean;
  email: string | null;
  isLoading: boolean;
  error: string | null;
}

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, refreshAuth } = useAuth();

  const [isSupported, setIsSupported] = useState(true);
  const [tokenState, setTokenState] = useState<TokenState>({
    isValid: false,
    email: null,
    isLoading: true,
    error: null,
  });
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const token = searchParams.get('token');

  /**
   * Check browser support on mount
   */
  useEffect(() => {
    setIsSupported(isPasskeySupported());
  }, []);

  /**
   * Redirect if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  /**
   * Redirect to login if no token provided
   */
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  /**
   * Validate token on mount
   */
  useEffect(() => {
    if (!token) return;

    async function validateToken() {
      try {
        const result = await apiClient.validateRegistrationToken(token!);
        setTokenState({
          isValid: result.valid,
          email: result.email,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid or expired link';
        setTokenState({
          isValid: false,
          email: null,
          isLoading: false,
          error: errorMessage.includes('API Error')
            ? 'This registration link is invalid or has expired.'
            : errorMessage,
        });
      }
    }

    validateToken();
  }, [token]);

  /**
   * Handle form submission - creates account with passkey
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!token || !name.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Get registration options from server
      // Note: For registration during signup, we use a simplified flow
      // The server generates options based on the token email
      const registrationOptions = await apiClient.getRegistrationOptions(token);

      // Step 2: Create passkey with browser WebAuthn API
      const credential = await startRegistration({ optionsJSON: registrationOptions });

      // Step 3: Complete registration on server
      await apiClient.completeRegistration({
        token,
        name: name.trim(),
        credential,
      });

      // Step 4: Refresh auth state to reflect new session
      await refreshAuth();

      // Step 5: Navigate to home (user is now logged in)
      navigate('/');
    } catch (error) {
      const err = error as Error;

      // Handle user cancellation gracefully
      if (err.name === 'NotAllowedError' || err.message.includes('cancelled')) {
        setSubmitError('Passkey setup was cancelled. Please try again.');
      }
      // Handle API errors
      else if (err.message.includes('API Error')) {
        const match = err.message.match(/API Error.*?: (.*)/);
        setSubmitError(match ? match[1] : 'Registration failed. Please try again.');
      }
      // Generic error
      else {
        setSubmitError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = name.trim().length > 0 && !isSubmitting && isSupported;

  // Loading state while validating token
  if (tokenState.isLoading) {
    return (
      <PageLayout>
        <div className="max-w-md mx-auto mt-12">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-gray-600 dark:text-gray-400">
                  Validating your registration link...
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  // Error state - invalid or expired token
  if (!tokenState.isValid || tokenState.error) {
    return (
      <PageLayout>
        <div className="max-w-md mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Invalid Link</CardTitle>
              <CardDescription>This registration link is no longer valid</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {tokenState.error ||
                    'This link may have expired or already been used. Please contact an administrator for a new invitation.'}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button variant="outline" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </PageLayout>
    );
  }

  // Registration form
  return (
    <PageLayout>
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Create Your Account</CardTitle>
            <CardDescription>Set up your account with a secure passkey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Browser Support Warning */}
            {!isSupported && (
              <div
                className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <strong className="font-medium">Browser not supported</strong>
                  <p className="mt-1">
                    Your browser does not support passkey authentication. Please use a modern
                    browser like Chrome, Edge, Safari, or Firefox.
                  </p>
                </div>
              </div>
            )}

            {/* Submit Error */}
            {submitError && (
              <div
                className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{submitError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email (read-only display) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </Label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-900 dark:text-gray-100">{tokenState.email}</span>
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Your Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isSubmitting}
                  className="h-11"
                  autoFocus
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" size="lg" className="w-full h-14 text-lg" disabled={!canSubmit}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Setting up passkey...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-5 w-5" />
                    Create Account with Passkey
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-center text-gray-600 dark:text-gray-400">
              Your account will be secured with a passkey - no password needed
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <a
            href="/login"
            onClick={e => {
              e.preventDefault();
              navigate('/login');
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </PageLayout>
  );
}

export default Register;
