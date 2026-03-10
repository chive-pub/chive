'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Save, Pencil, Copy, Check, LayoutGrid, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { useCurrentUser, useAgent } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChiveProfileForm } from '@/components/settings/chive-profile-form';
import { DiscoverySettingsPanel } from '@/components/settings/discovery-settings-panel';

/**
 * Renders text with URLs converted to clickable links.
 */
function Linkify({ text, className }: { text: string; className?: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </span>
  );
}

/**
 * User settings page.
 *
 * @remarks
 * Profile data is read from the user's PDS via ATProto.
 * Display name and bio can be edited directly, writing back to the PDS.
 */
export default function SettingsPage() {
  const user = useCurrentUser();
  const agent = useAgent();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  // Sync form state when user data loads
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setDescription(user.description ?? '');
    }
  }, [user]);

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ??
    user?.handle?.slice(0, 2).toUpperCase() ??
    '?';

  const handleSave = async () => {
    if (!agent?.did) return;

    setSaving(true);
    try {
      // Read existing profile record to preserve avatar/banner blobs
      let existingRecord: Record<string, unknown> = {};
      try {
        const existing = await agent.com.atproto.repo.getRecord({
          repo: agent.did,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
        });
        if (existing.data.value) {
          existingRecord = existing.data.value as Record<string, unknown>;
        }
      } catch {
        // No existing record, that's fine
      }

      await agent.com.atproto.repo.putRecord({
        repo: agent.did,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          ...existingRecord,
          $type: 'app.bsky.actor.profile',
          displayName: displayName || undefined,
          description: description || undefined,
        },
      });

      setEditing(false);
      toast.success('Profile updated', {
        description: 'Changes saved to your PDS and will sync to Bluesky.',
      });

      // Reload to pick up changes
      window.location.reload();
    } catch (error) {
      toast.error('Failed to save profile', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName ?? '');
    setDescription(user?.description ?? '');
    setEditing(false);
  };

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your profile data is stored in your Personal Data Server (PDS)
              </CardDescription>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {editing ? (
            /* Edit mode */
            <div className="space-y-4">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.avatar} alt={displayName || user?.handle} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Bio</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell people about yourself"
                      rows={3}
                      maxLength={2000}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* View mode */
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
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    <Linkify text={user.description} />
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Account Details */}
          <div className="grid gap-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:items-center">
              <span className="text-sm font-medium text-muted-foreground">DID</span>
              <div className="col-span-2 flex items-center gap-2">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                  {user?.did ?? 'Not available'}
                </code>
                {user?.did && <CopyButton value={user.did} />}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:items-center">
              <span className="text-sm font-medium text-muted-foreground">Handle</span>
              <span className="col-span-2 text-sm">{user?.handle ?? 'Not available'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 sm:items-center">
              <span className="text-sm font-medium text-muted-foreground">PDS</span>
              <span className="col-span-2 text-sm font-mono">
                {user?.pdsEndpoint ?? 'Not available'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Display Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Profile Display
          </CardTitle>
          <CardDescription>
            Configure the layout and sections visible on your public profile page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard/settings/profile-display"
            className="flex items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted"
          >
            <div>
              <p className="text-sm font-medium">Customize profile layout</p>
              <p className="text-xs text-muted-foreground">
                Reorder sections, toggle visibility, set profile type, and feature a collection
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Chive Academic Profile */}
      <ChiveProfileForm />

      {/* Discovery Settings */}
      <DiscoverySettingsPanel />
    </div>
  );
}

/**
 * Small button that copies a value to the clipboard.
 */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}
