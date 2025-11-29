/**
 * Account Page (/account)
 *
 * User account management with profile info and passkey management.
 * Protected route - redirects to /login if not authenticated.
 *
 * Architecture:
 * - Single Responsibility: Manages only account UI and passkey operations
 * - Dependency Inversion: Uses AuthContext and apiClient abstractions
 * - Open/Closed: Extensible via additional account features
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
import { Badge } from '../components/ui/badge.js';
import { Separator } from '../components/ui/separator.js';
import {
  Smartphone,
  Laptop,
  Shield,
  Tablet,
  Monitor,
  Plus,
  Trash2,
  Edit,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiClient } from '../services/apiClient.js';
import { startRegistration } from '@simplewebauthn/browser';
import type { Passkey, ProfileResponse } from '../services/types.js';

const deviceIcons = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
  'security-key': Shield,
};

export function Account() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState<string | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  /**
   * Redirect to login if not authenticated
   */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  /**
   * Load profile and passkeys on mount
   */
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadAccountData();
    }
  }, [isAuthenticated, authLoading]);

  /**
   * Load profile and passkeys data
   */
  const loadAccountData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [profileData, passkeysData] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getPasskeys(),
      ]);

      setProfile(profileData);
      setPasskeys(passkeysData.passkeys);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add new passkey
   */
  const handleAddPasskey = async () => {
    setIsAdding(true);
    setError(null);

    try {
      // Step 1: Get registration options from server
      const options = await apiClient.registerPasskeyStart();

      // Step 2: Prompt user for passkey registration
      const credential = await startRegistration({ optionsJSON: options as never });

      // Step 3: Verify registration with server
      const result = await apiClient.registerPasskeyVerify({
        credential: {
          id: credential.id,
          rawId: credential.rawId,
          response: {
            clientDataJSON: credential.response.clientDataJSON,
            attestationObject: credential.response.attestationObject,
          },
          type: credential.type,
        },
        name: 'New Device',
      });

      if (result.verified) {
        // Reload passkeys
        await loadAccountData();
      }
    } catch (err) {
      const error = err as Error;

      // Handle user cancellation gracefully
      if (error.name === 'NotAllowedError' || error.message.includes('cancelled')) {
        setError('Passkey registration was cancelled');
      } else {
        setError(error.message || 'Failed to add passkey');
      }
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * Remove passkey with confirmation
   */
  const handleRemovePasskey = async (id: string) => {
    setError(null);

    try {
      await apiClient.removePasskey(id);
      setShowRemoveDialog(null);
      await loadAccountData();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to remove passkey');
    }
  };

  /**
   * Rename passkey
   */
  const handleRenamePasskey = async (id: string) => {
    if (!newName.trim()) {
      setError('Passkey name cannot be empty');
      return;
    }

    setError(null);

    try {
      await apiClient.renamePasskey(id, newName);
      setShowRenameDialog(null);
      setNewName('');
      await loadAccountData();
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to rename passkey');
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'Failed to logout');
    }
  };

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto">
          <p>Loading...</p>
        </div>
      </PageLayout>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (!isAuthenticated || !profile) {
    return null;
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Account</h1>
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-6"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Profile Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Passkeys</CardTitle>
                <CardDescription>Manage your passwordless authentication devices</CardDescription>
              </div>
              <Button onClick={handleAddPasskey} disabled={isAdding} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {isAdding ? 'Adding...' : 'Add New Passkey'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {passkeys.map((passkey, index) => {
                const Icon = deviceIcons[passkey.deviceType];
                const isLastPasskey = passkeys.length === 1;

                return (
                  <div key={passkey.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {passkey.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Added: {new Date(passkey.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Last used: {new Date(passkey.lastUsed).toLocaleDateString()}
                        </Badge>
                        <Button
                          onClick={() => {
                            setShowRenameDialog(passkey.id);
                            setNewName(passkey.name);
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Rename</span>
                        </Button>
                        <Button
                          onClick={() => setShowRemoveDialog(passkey.id)}
                          variant="ghost"
                          size="sm"
                          disabled={isLastPasskey}
                          title={
                            isLastPasskey
                              ? 'Cannot remove last passkey. Add another passkey before removing this one.'
                              : 'Remove passkey'
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>
                    {index < passkeys.length - 1 && <Separator className="my-4" />}

                    {/* Remove Confirmation Dialog */}
                    {showRemoveDialog === passkey.id && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="max-w-md">
                          <CardHeader>
                            <CardTitle>Remove Passkey?</CardTitle>
                            <CardDescription>
                              Are you sure you want to remove &quot;{passkey.name}&quot;? This
                              action cannot be undone.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="flex justify-end gap-2">
                            <Button onClick={() => setShowRemoveDialog(null)} variant="outline">
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleRemovePasskey(passkey.id)}
                              variant="destructive"
                            >
                              Remove
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Rename Dialog */}
                    {showRenameDialog === passkey.id && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="max-w-md">
                          <CardHeader>
                            <CardTitle>Rename Passkey</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <input
                              type="text"
                              value={newName}
                              onChange={e => {
                                const target = e.target as unknown as { value: string };
                                setNewName(target.value);
                              }}
                              className="w-full px-3 py-2 border rounded-md"
                              placeholder="Enter new name"
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => {
                                  setShowRenameDialog(null);
                                  setNewName('');
                                }}
                                variant="outline"
                              >
                                Cancel
                              </Button>
                              <Button onClick={() => handleRenamePasskey(passkey.id)}>Save</Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
