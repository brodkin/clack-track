/**
 * Login Page (/login)
 *
 * Simple passkey sign-in button (non-functional mockup)
 */

import { PageLayout } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Shield } from 'lucide-react';

export function Login() {
  const handlePasskeySignIn = () => {
    // Placeholder - will implement WebAuthn later
    console.log('Passkey sign-in requested (will implement WebAuthn in future iteration)');
  };

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
            <Button
              onClick={handlePasskeySignIn}
              size="lg"
              className="w-full h-14 text-lg"
              variant="default"
            >
              <Shield className="mr-2 h-5 w-5" />
              Sign in with Passkey
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
