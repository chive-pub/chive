'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Save,
  Loader2,
  GripVertical,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Star,
  ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useProfileConfig,
  useUpdateProfileConfig,
  type ProfileSection,
} from '@/lib/hooks/use-profile-config';
import { useMyCollections, type CollectionView } from '@/lib/hooks/use-collections';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Available profile sections that can be configured.
 */
const AVAILABLE_SECTIONS = [
  { id: 'collections', label: 'Collections', description: 'Your curated collections' },
  { id: 'eprints', label: 'Eprints', description: 'Your submitted papers' },
  { id: 'reviews', label: 'Reviews', description: 'Your reviews and comments' },
  { id: 'endorsements', label: 'Endorsements', description: 'Your endorsements' },
  { id: 'proposals', label: 'Proposals', description: 'Your graph proposals' },
] as const;

/**
 * Profile type options.
 */
const PROFILE_TYPES = [
  {
    value: 'individual',
    label: 'Individual',
    description: 'Researcher, student, or independent scholar',
  },
  {
    value: 'organization',
    label: 'Organization',
    description: 'Research lab, institute, or university department',
  },
  {
    value: 'conference',
    label: 'Conference',
    description: 'Conference, workshop, or symposium',
  },
] as const;

type ProfileType = (typeof PROFILE_TYPES)[number]['value'];

/**
 * Default section orderings per profile type.
 */
const DEFAULT_SECTIONS: Record<ProfileType, ProfileSection[]> = {
  individual: [
    { id: 'eprints', visible: true, order: 0 },
    { id: 'reviews', visible: true, order: 1 },
    { id: 'endorsements', visible: true, order: 2 },
    { id: 'collections', visible: true, order: 3 },
    { id: 'proposals', visible: true, order: 4 },
  ],
  organization: [
    { id: 'collections', visible: true, order: 0 },
    { id: 'eprints', visible: true, order: 1 },
    { id: 'endorsements', visible: true, order: 2 },
    { id: 'reviews', visible: true, order: 3 },
    { id: 'proposals', visible: true, order: 4 },
  ],
  conference: [
    { id: 'collections', visible: true, order: 0 },
    { id: 'eprints', visible: true, order: 1 },
    { id: 'proposals', visible: true, order: 2 },
    { id: 'reviews', visible: true, order: 3 },
    { id: 'endorsements', visible: true, order: 4 },
  ],
};

// =============================================================================
// SECTION LIST COMPONENT
// =============================================================================

interface SectionListProps {
  sections: ProfileSection[];
  onReorder: (sections: ProfileSection[]) => void;
}

/**
 * Sortable section list with visibility toggles and reorder buttons.
 */
function SectionList({ sections, onReorder }: SectionListProps) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const updated = sorted.map((s, i) => {
      if (i === index) return { ...s, order: swapIndex };
      if (i === swapIndex) return { ...s, order: index };
      return { ...s, order: i };
    });
    onReorder(updated);
  };

  const toggleVisibility = (sectionId: string) => {
    const updated = sorted.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s));
    onReorder(updated);
  };

  const getSectionMeta = (id: string) => AVAILABLE_SECTIONS.find((s) => s.id === id);

  return (
    <div className="space-y-2">
      {sorted.map((section, index) => {
        const meta = getSectionMeta(section.id);
        if (!meta) return null;

        return (
          <div
            key={section.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 transition-colors',
              section.visible ? 'bg-background' : 'bg-muted/50 opacity-60'
            )}
          >
            {/* Drag handle indicator */}
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />

            {/* Section info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>

            {/* Reorder buttons */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => moveSection(index, 'up')}
                aria-label={`Move ${meta.label} up`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={index === sorted.length - 1}
                onClick={() => moveSection(index, 'down')}
                aria-label={`Move ${meta.label} down`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Visibility toggle */}
            <div className="flex items-center gap-2">
              {section.visible ? (
                <Eye className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Switch
                checked={section.visible}
                onCheckedChange={() => toggleVisibility(section.id)}
                aria-label={`Toggle ${meta.label} visibility`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// FEATURED COLLECTION PICKER
// =============================================================================

interface FeaturedCollectionPickerProps {
  collections: CollectionView[];
  value: string | undefined;
  onChange: (uri: string | undefined) => void;
  isLoading: boolean;
}

/**
 * Select dropdown for choosing a featured collection.
 */
function FeaturedCollectionPicker({
  collections,
  value,
  onChange,
  isLoading,
}: FeaturedCollectionPickerProps) {
  const publicCollections = collections.filter((c) => c.visibility === 'public');

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Featured Collection</Label>
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="featured-collection">Featured Collection</Label>
      <p className="text-xs text-muted-foreground">
        Pin a collection at the top of your public profile for visitors to see first.
      </p>
      <Select value={value ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? undefined : v)}>
        <SelectTrigger id="featured-collection">
          <SelectValue placeholder="No featured collection" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No featured collection</SelectItem>
          {publicCollections.map((collection) => (
            <SelectItem key={collection.uri} value={collection.uri}>
              <div className="flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                <span>{collection.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {publicCollections.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No public collections found.{' '}
          <Link href="/dashboard/collections" className="text-primary hover:underline">
            Create one
          </Link>{' '}
          to feature on your profile.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

/**
 * Profile display configuration settings page.
 *
 * @remarks
 * Allows users to configure how their public profile page is rendered,
 * including section ordering, visibility, profile type, and which collection
 * to feature prominently.
 */
export default function ProfileDisplaySettingsPage() {
  const user = useCurrentUser();
  const did = user?.did ?? '';

  const { data: existingConfig, isLoading: isLoadingConfig } = useProfileConfig(did, {
    enabled: !!did,
  });
  const { data: collectionsData, isLoading: isLoadingCollections } = useMyCollections(did, {
    enabled: !!did,
  });
  const { mutate: updateConfig, isPending } = useUpdateProfileConfig();

  // Local form state
  const [profileType, setProfileType] = useState<ProfileType>('individual');
  const [sections, setSections] = useState<ProfileSection[]>(DEFAULT_SECTIONS.individual);
  const [featuredCollectionUri, setFeaturedCollectionUri] = useState<string | undefined>(undefined);
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing config into form state
  useEffect(() => {
    if (existingConfig) {
      const type = (existingConfig.profileType ?? 'individual') as ProfileType;
      setProfileType(type);
      setSections(
        existingConfig.sections.length > 0 ? existingConfig.sections : DEFAULT_SECTIONS[type]
      );
      setFeaturedCollectionUri(existingConfig.featuredCollectionUri);
    }
  }, [existingConfig]);

  // Track changes
  const handleProfileTypeChange = useCallback(
    (type: ProfileType) => {
      setProfileType(type);
      // If no existing config, apply defaults for the new type
      if (!existingConfig) {
        setSections(DEFAULT_SECTIONS[type]);
      }
      setHasChanges(true);
    },
    [existingConfig]
  );

  const handleSectionsChange = useCallback((updated: ProfileSection[]) => {
    setSections(updated);
    setHasChanges(true);
  }, []);

  const handleFeaturedChange = useCallback((uri: string | undefined) => {
    setFeaturedCollectionUri(uri);
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    // Normalize order values to be sequential
    const normalizedSections = [...sections]
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }));

    updateConfig(
      {
        profileType,
        sections: normalizedSections,
        featuredCollectionUri,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
          toast.success('Profile display settings saved', {
            description: 'Your profile layout will update shortly.',
          });
        },
        onError: (error) => {
          toast.error('Failed to save settings', {
            description: error.message || 'Please try again.',
          });
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/dashboard/settings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Profile Display</h1>
        <p className="text-muted-foreground">
          Configure how your public profile page appears to visitors
        </p>
      </div>

      {/* Profile Type */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Type</CardTitle>
          <CardDescription>
            Choose the type that best describes your profile. This affects the default layout and
            visual styling of your public page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={profileType}
            onValueChange={(v) => handleProfileTypeChange(v as ProfileType)}
            className="space-y-3"
          >
            {PROFILE_TYPES.map((type) => (
              <div key={type.value} className="flex items-start gap-3">
                <RadioGroupItem
                  value={type.value}
                  id={`profile-type-${type.value}`}
                  className="mt-1"
                />
                <Label
                  htmlFor={`profile-type-${type.value}`}
                  className="cursor-pointer leading-normal"
                >
                  <span className="font-medium">{type.label}</span>
                  <span className="block text-xs text-muted-foreground">{type.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Section Ordering */}
      <Card>
        <CardHeader>
          <CardTitle>Section Order</CardTitle>
          <CardDescription>
            Reorder and toggle visibility of sections on your profile page. Use the arrow buttons to
            change order and the toggle to show or hide sections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfig ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : (
            <SectionList sections={sections} onReorder={handleSectionsChange} />
          )}
        </CardContent>
      </Card>

      {/* Featured Collection */}
      <Card>
        <CardHeader>
          <CardTitle>Featured Collection</CardTitle>
          <CardDescription>
            Highlight one of your public collections at the top of your profile page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeaturedCollectionPicker
            collections={collectionsData?.collections ?? []}
            value={featuredCollectionUri}
            onChange={handleFeaturedChange}
            isLoading={isLoadingCollections}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          {hasChanges
            ? 'You have unsaved changes.'
            : 'Your profile display settings are up to date.'}
        </p>
        <Button onClick={handleSave} disabled={isPending || !hasChanges}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
