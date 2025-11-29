/**
 * Login Page (/login)
 *
 * WebAuthn passkey authentication with browser support detection.
 * Handles login flow: idle → loading → success/error → redirect
 *
 * Architecture:
 * - Single Responsibility: Manages only login UI and flow
 * - Dependency Inversion: Uses AuthContext abstraction
 * - Open/Closed: Extensible via additional auth methods
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/PageLayout.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../components/ui/card.js';
import { Button } from '../components/ui/button.js';
import { Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

/**
 * Check if browser supports WebAuthn passkeys
 */
function isPasskeySupported(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined' &&
    typeof (
      globalThis as {
        PublicKeyCredential?: { isConditionalMediationAvailable?: unknown };
      }
    ).PublicKeyCredential?.isConditionalMediationAvailable === 'function'
  );
}

export function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  /**
   * Check browser support on mount
   */
  useEffect(() => {
    setIsSupported(isPasskeySupported());
  }, []);

  /**
   * Redirect to home if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  /**
   * Handle passkey sign-in
   */
  const handlePasskeySignIn = async () => {
    setError(null);
    setIsAuthenticating(true);

    try {
      await login();
      // Navigation happens via useEffect after isAuthenticated changes
    } catch (err) {
      const error = err as Error;

      // Handle user cancellation gracefully
      if (error.name === 'NotAllowedError' || error.message.includes('cancelled')) {
        setError('Authentication was cancelled. Please try again.');
      }
      // Handle API errors
      else if (error.message.includes('API Error')) {
        const match = error.message.match(/API Error.*?: (.*)/);
        setError(match ? match[1] : 'Authentication failed. Please try again.');
      }
      // Generic error
      else {
        setError(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const isLoading = isAuthenticating || authLoading;

  return (
    <PageLayout>
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your Clack Track account</CardDescription>
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

            {/* Error Message */}
            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                role="alert"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Sign In Button */}
            <Button
              onClick={handlePasskeySignIn}
              size="lg"
              className="w-full h-14 text-lg"
              variant="default"
              disabled={!isSupported || isLoading}
            >
              <Shield className="mr-2 h-5 w-5" />
              {isLoading ? 'Signing in...' : 'Sign in with Passkey'}
            </Button>

            <p className="text-xs text-center text-gray-600 dark:text-gray-400">
              Passwordless authentication using WebAuthn
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          Don&apos;t have an account?{' '}
          <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
            Create one
          </a>
        </p>
      </div>
    </PageLayout>
  );
}
