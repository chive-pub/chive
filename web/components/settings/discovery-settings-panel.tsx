'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  Quote,
  FileText,
  Users,
  TrendingUp,
  Tag,
  ChevronDown,
  ChevronRight,
  Loader2,
  Shuffle,
  ThumbsUp,
  GitBranch,
  UserCheck,
  Eye,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDiscoverySettings,
  useUpdateDiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
} from '@/lib/hooks/use-discovery';
import type { DiscoverySettings } from '@/lib/hooks/use-discovery';
import { FieldSearch, type FieldSelection } from '@/components/forms/field-search';
import type { CitationNetworkDisplay } from '@/lib/api/schema';

/**
 * Collapsible section component.
 */
function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 space-y-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Toggle row with label and description.
 */
function SettingToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  icon: Icon,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/**
 * Loading skeleton for discovery settings.
 */
function DiscoverySettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/**
 * Discovery settings panel component.
 *
 * @remarks
 * Allows users to configure their discovery preferences including
 * For You feed settings, related papers signals, and citation network display.
 * Changes are collected locally and saved with an explicit Save button.
 */
export function DiscoverySettingsPanel() {
  const { data: settings, isLoading } = useDiscoverySettings();
  const { mutate: updateSettings, isPending } = useUpdateDiscoverySettings();

  // Local draft state - user edits this, then saves explicitly
  const [draft, setDraft] = useState<DiscoverySettings>(DEFAULT_DISCOVERY_SETTINGS);
  const [initialized, setInitialized] = useState(false);

  // Followed fields with labels (separate from draft.followedFieldUris which only stores URIs)
  const [followedFields, setFollowedFields] = useState<FieldSelection[]>([]);

  // Sync from server settings when they load
  useEffect(() => {
    if (settings && !initialized) {
      setDraft(settings);
      setInitialized(true);
    }
  }, [settings, initialized]);

  // Resolve followed field labels when settings load
  useEffect(() => {
    const uris = settings?.followedFieldUris ?? [];
    if (uris.length > 0 && followedFields.length === 0) {
      setFollowedFields(uris.map((uri) => ({ uri, label: 'Loading...' })));
      Promise.all(
        uris.map(async (uri) => {
          try {
            const { api: publicApi } = await import('@/lib/api/client');
            const response = await publicApi.pub.chive.graph.getNode({ id: uri });
            return { uri, label: response.data.label ?? uri };
          } catch {
            return { uri, label: uri };
          }
        })
      ).then((resolved) => setFollowedFields(resolved));
    }
  }, [settings?.followedFieldUris]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if draft differs from saved settings
  const isDirty = initialized && JSON.stringify(draft) !== JSON.stringify(settings);

  // Local update helpers - modify draft only, don't save
  const updateDraft = useCallback((partial: Partial<DiscoverySettings>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const updateDraftForYouSignal = useCallback((signal: string, value: boolean) => {
    setDraft((prev) => ({
      ...prev,
      forYouSignals: { ...prev.forYouSignals, [signal]: value },
    }));
  }, []);

  const updateDraftRelatedSignal = useCallback((signal: string, value: boolean) => {
    setDraft((prev) => ({
      ...prev,
      relatedPapersSignals: { ...prev.relatedPapersSignals, [signal]: value },
    }));
  }, []);

  const handleFollowedFieldAdd = useCallback(
    (field: FieldSelection) => {
      const updated = [...followedFields, field];
      setFollowedFields(updated);
      setDraft((prev) => ({ ...prev, followedFieldUris: updated.map((f) => f.uri) }));
    },
    [followedFields]
  );

  const handleFollowedFieldRemove = useCallback(
    (field: FieldSelection) => {
      const updated = followedFields.filter((f) => f.uri !== field.uri);
      setFollowedFields(updated);
      setDraft((prev) => ({ ...prev, followedFieldUris: updated.map((f) => f.uri) }));
    },
    [followedFields]
  );

  const handleSave = () => {
    updateSettings(draft, {
      onSuccess: () => {
        toast.success('Discovery settings saved');
      },
      onError: (error) => {
        toast.error('Failed to save', {
          description: error.message || 'Could not update discovery settings',
        });
      },
    });
  };

  if (isLoading) {
    return <DiscoverySettingsSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Discovery Settings
        </CardTitle>
        <CardDescription>
          Configure how Chive recommends papers based on your research interests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Toggles */}
        <div className="space-y-2 pb-4 border-b">
          <SettingToggle
            id="enablePersonalization"
            label="Enable Personalization"
            description="Use your profile and activity to improve recommendations"
            checked={draft.enablePersonalization}
            onCheckedChange={(checked) => updateDraft({ enablePersonalization: checked })}
            disabled={isPending}
          />

          <SettingToggle
            id="enableForYouFeed"
            label="Show For You Feed"
            description="Display personalized paper recommendations on your home page"
            checked={draft.enableForYouFeed}
            onCheckedChange={(checked) => updateDraft({ enableForYouFeed: checked })}
            disabled={isPending || !draft.enablePersonalization}
          />

          <SettingToggle
            id="showRecommendationReasons"
            label="Show Recommendation Reasons"
            description="Display explanations for why papers are recommended"
            checked={draft.showRecommendationReasons}
            onCheckedChange={(checked) => updateDraft({ showRecommendationReasons: checked })}
            disabled={isPending}
          />
        </div>

        {/* For You Feed Signals */}
        <CollapsibleSection title="For You Feed Sources" icon={Sparkles} defaultOpen>
          <p className="text-sm text-muted-foreground mb-3">
            Choose which signals to use for your personalized feed.
          </p>

          <div className="space-y-1">
            <SettingToggle
              id="forYou-fields"
              label="Research Fields"
              description="Papers in your research areas"
              icon={Tag}
              checked={draft.forYouSignals.fields ?? true}
              onCheckedChange={(checked) => updateDraftForYouSignal('fields', checked)}
              disabled={isPending || !draft.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-citations"
              label="Citations"
              description="Papers citing or related to your work"
              icon={Quote}
              checked={draft.forYouSignals.citations ?? true}
              onCheckedChange={(checked) => updateDraftForYouSignal('citations', checked)}
              disabled={isPending || !draft.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-collaborators"
              label="Collaborators"
              description="Papers from your co-authors and collaborators"
              icon={Users}
              checked={draft.forYouSignals.collaborators ?? true}
              onCheckedChange={(checked) => updateDraftForYouSignal('collaborators', checked)}
              disabled={isPending || !draft.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-trending"
              label="Trending"
              description="Popular papers in your fields"
              icon={TrendingUp}
              checked={draft.forYouSignals.trending ?? true}
              onCheckedChange={(checked) => updateDraftForYouSignal('trending', checked)}
              disabled={isPending || !draft.enableForYouFeed}
            />
          </div>
        </CollapsibleSection>

        {/* Related Papers Signals */}
        <CollapsibleSection title="Related Papers" icon={FileText}>
          <p className="text-sm text-muted-foreground mb-3">
            Configure what to show in the Related Papers panel on eprint pages.
          </p>

          <div className="space-y-1">
            <SettingToggle
              id="related-citations"
              label="Citation Relationships"
              description="Papers that cite or are cited by this paper"
              icon={Quote}
              checked={draft.relatedPapersSignals.citations ?? true}
              onCheckedChange={(checked) => updateDraftRelatedSignal('citations', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-topics"
              label="Topic Similarity"
              description="Papers on similar topics and concepts"
              icon={Tag}
              checked={draft.relatedPapersSignals.topics ?? true}
              onCheckedChange={(checked) => updateDraftRelatedSignal('topics', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-authors"
              label="Author Overlap"
              description="Papers sharing one or more authors"
              icon={UserCheck}
              checked={(draft.relatedPapersSignals as Record<string, boolean>).authors ?? true}
              onCheckedChange={(checked) => updateDraftRelatedSignal('authors', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-bibcoupling"
              label="Bibliographic Coupling"
              description="Papers that cite the same references"
              icon={GitBranch}
              checked={
                (draft.relatedPapersSignals as Record<string, boolean>).bibliographicCoupling ??
                true
              }
              onCheckedChange={(checked) =>
                updateDraftRelatedSignal('bibliographicCoupling', checked)
              }
              disabled={isPending}
            />
          </div>
        </CollapsibleSection>

        {/* Citation Network Display */}
        <CollapsibleSection title="Citation Network Display" icon={Quote}>
          <p className="text-sm text-muted-foreground mb-3">
            How to display the citation network on eprint pages.
          </p>

          <RadioGroup
            value={draft.citationNetworkDisplay}
            onValueChange={(value) =>
              updateDraft({ citationNetworkDisplay: value as CitationNetworkDisplay })
            }
            disabled={isPending}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="hidden" id="citation-hidden" />
              <Label htmlFor="citation-hidden" className="cursor-pointer">
                <span className="font-medium">Hidden</span>
                <p className="text-xs text-muted-foreground">Don&apos;t show citation network</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="preview" id="citation-preview" />
              <Label htmlFor="citation-preview" className="cursor-pointer">
                <span className="font-medium">Preview</span>
                <p className="text-xs text-muted-foreground">Show collapsed summary with counts</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="expanded" id="citation-expanded" />
              <Label htmlFor="citation-expanded" className="cursor-pointer">
                <span className="font-medium">Expanded</span>
                <p className="text-xs text-muted-foreground">Show full citation list by default</p>
              </Label>
            </div>
          </RadioGroup>
        </CollapsibleSection>

        {/* Recommendation Diversity */}
        <CollapsibleSection title="Recommendation Diversity" icon={Shuffle}>
          <p className="text-sm text-muted-foreground mb-3">
            Control how varied your recommendations are relative to your research fields.
          </p>

          <RadioGroup
            value={draft.recommendationDiversity ?? 'medium'}
            onValueChange={(value) =>
              updateDraft({ recommendationDiversity: value as 'low' | 'medium' | 'high' })
            }
            disabled={isPending}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="low" id="diversity-low" />
              <Label htmlFor="diversity-low" className="cursor-pointer">
                <span className="font-medium">Low</span>
                <p className="text-xs text-muted-foreground">Closely match your fields</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="medium" id="diversity-medium" />
              <Label htmlFor="diversity-medium" className="cursor-pointer">
                <span className="font-medium">Medium</span>
                <p className="text-xs text-muted-foreground">
                  Balance between relevance and variety
                </p>
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="high" id="diversity-high" />
              <Label htmlFor="diversity-high" className="cursor-pointer">
                <span className="font-medium">High</span>
                <p className="text-xs text-muted-foreground">
                  Include more interdisciplinary papers
                </p>
              </Label>
            </div>
          </RadioGroup>
        </CollapsibleSection>

        {/* Minimum Endorsement Threshold */}
        <CollapsibleSection title="Quality Filter" icon={ThumbsUp}>
          <p className="text-sm text-muted-foreground mb-3">
            Set a minimum number of endorsements for papers to appear in your recommendations.
          </p>

          <RadioGroup
            value={String(draft.minimumEndorsementThreshold ?? 0)}
            onValueChange={(value) =>
              updateDraft({ minimumEndorsementThreshold: parseInt(value, 10) })
            }
            disabled={isPending}
            className="space-y-2"
          >
            {[0, 1, 3, 5].map((threshold) => (
              <div key={threshold} className="flex items-center space-x-3">
                <RadioGroupItem value={String(threshold)} id={`endorsement-${threshold}`} />
                <Label htmlFor={`endorsement-${threshold}`} className="cursor-pointer">
                  <span className="font-medium">
                    {threshold === 0 ? 'No minimum' : `${threshold}+ endorsements`}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {threshold === 0
                      ? 'Show all papers regardless of endorsements'
                      : `Only show papers with at least ${threshold} endorsement${threshold > 1 ? 's' : ''}`}
                  </p>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CollapsibleSection>

        {/* Followed Fields */}
        <CollapsibleSection title="Followed Fields" icon={Eye}>
          <p className="text-sm text-muted-foreground mb-3">
            Follow fields to see their trending papers on the Trending page, separate from the
            fields you work in. For example, a computational linguist might follow NLP without
            listing it as a work field.
          </p>

          <FieldSearch
            selectedFields={followedFields}
            onFieldAdd={handleFollowedFieldAdd}
            onFieldRemove={handleFollowedFieldRemove}
            maxFields={50}
            disabled={isPending}
          />

          <SettingToggle
            id="followingTabIncludesWorkFields"
            label="Include work fields in Following tab"
            description="When enabled, the Following tab on Trending also shows papers from your work fields"
            checked={draft.followingTabIncludesWorkFields ?? false}
            onCheckedChange={(checked) => updateDraft({ followingTabIncludesWorkFields: checked })}
            disabled={isPending}
          />
        </CollapsibleSection>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isPending || !isDirty}>
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
      </CardContent>
    </Card>
  );
}
