'use client';

import { User, ExternalLink } from 'lucide-react';

import { useCurrentUser } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChiveProfileForm } from '@/components/settings/chive-profile-form';
import { DiscoverySettingsPanel } from '@/components/settings/discovery-settings-panel';

/**
 * User settings page.
 *
 * @remarks
 * Profile data is read from the user's PDS via ATProto.
 * This is read-only; editing happens at the user's PDS.
 */
export default function SettingsPage() {
  const user = useCurrentUser();

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ??
    user?.handle?.slice(0, 2).toUpperCase() ??
    '?';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">View your profile and account information</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your profile data is stored in your Personal Data Server (PDS)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar} alt={user?.displayName ?? user?.handle} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">
                {user?.displayName ?? user?.handle ?? 'Unknown User'}
              </h3>
              <p className="text-sm text-muted-foreground">@{user?.handle}</p>
              {user?.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-md">{user.description}</p>
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className="grid gap-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm font-medium text-muted-foreground">DID</span>
              <code className="col-span-2 text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                {user?.did ?? 'Not available'}
              </code>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm font-medium text-muted-foreground">Handle</span>
              <span className="col-span-2 text-sm">{user?.handle ?? 'Not available'}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center">
              <span className="text-sm font-medium text-muted-foreground">PDS</span>
              <span className="col-span-2 text-sm font-mono">
                {user?.pdsEndpoint ?? 'Not available'}
              </span>
            </div>
          </div>

          {/* Edit Profile Note */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Edit your profile</p>
                  <p className="text-xs text-muted-foreground">
                    Profile changes are made through your PDS provider
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://bsky.app/settings/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Edit on Bluesky
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chive Academic Profile */}
      <ChiveProfileForm />

      {/* Discovery Settings */}
      <DiscoverySettingsPanel />

      {/* ATProto Info */}
      <Card>
        <CardHeader>
          <CardTitle>About ATProto</CardTitle>
          <CardDescription>Your data, your control</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chive is built on the AT Protocol. Your preprints, reviews, and endorsements are stored
            in your Personal Data Server (PDS), not on Chive&apos;s servers. This means you maintain
            full ownership and portability of your scholarly work.
          </p>
          <div className="mt-4 flex gap-4">
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://atproto.com" target="_blank" rel="noopener noreferrer">
                Learn about ATProto
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
