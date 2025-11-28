/**
 * Account Page (/account)
 *
 * Displays user profile information and passkey list
 */

import { PageLayout } from '../components/PageLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { mockUserProfile, mockPasskeys } from '../lib/mockData';
import { Smartphone, Laptop, Shield, Tablet, Monitor } from 'lucide-react';

const deviceIcons = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
  'security-key': Shield,
};

export function Account() {
  const profile = mockUserProfile;
  const passkeys = mockPasskeys;

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Account</h1>

        {/* Profile Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
              <p className="font-semibold text-gray-900 dark:text-white">{profile.name}</p>
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
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Login</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {new Date(profile.lastLogin).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Passkeys */}
        <Card>
          <CardHeader>
            <CardTitle>Passkeys</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your passwordless authentication devices
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {passkeys.map((passkey, index) => {
                const Icon = deviceIcons[passkey.deviceType];
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
                      <Badge variant="outline" className="text-xs">
                        Last used: {new Date(passkey.lastUsed).toLocaleDateString()}
                      </Badge>
                    </div>
                    {index < passkeys.length - 1 && <Separator className="my-4" />}
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
