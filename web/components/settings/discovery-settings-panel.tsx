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
  SlidersHorizontal,
  RotateCcw,
  Brain,
  Filter,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  useDiscoverySettings,
  useUpdateDiscoverySettings,
  DEFAULT_DISCOVERY_SETTINGS,
  DEFAULT_RELATED_PAPERS_WEIGHTS,
  DEFAULT_RELATED_PAPERS_THRESHOLDS,
  DEFAULT_TRENDING_PREFERENCES,
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
 * Weight slider with label, value display, and optional icon.
 */
function WeightSlider({
  label,
  value,
  onChange,
  disabled,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <Label className="text-sm">{label}</Label>
        </div>
        <span className="text-xs font-mono text-muted-foreground tabular-nums w-8 text-right">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        className="w-full"
      />
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
 * related papers signals, signal weights, thresholds, and trending
 * preferences.
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

  const updateDraftRelatedSignal = useCallback(
    (signal: keyof DiscoverySettings['relatedPapersSignals'], value: boolean) => {
      setDraft((prev) => ({
        ...prev,
        relatedPapersSignals: { ...prev.relatedPapersSignals, [signal]: value },
      }));
    },
    []
  );

  const updateDraftRelatedWeight = useCallback(
    (signal: keyof DiscoverySettings['relatedPapersWeights'], value: number) => {
      setDraft((prev) => ({
        ...prev,
        relatedPapersWeights: { ...prev.relatedPapersWeights, [signal]: value },
      }));
    },
    []
  );

  const updateDraftThreshold = useCallback((key: 'minScore' | 'maxResults', value: number) => {
    setDraft((prev) => ({
      ...prev,
      relatedPapersThresholds: { ...prev.relatedPapersThresholds, [key]: value },
    }));
  }, []);

  const updateDraftTrending = useCallback(
    (key: 'defaultWindow' | 'defaultLimit', value: string | number) => {
      setDraft((prev) => ({
        ...prev,
        trendingPreferences: { ...prev.trendingPreferences, [key]: value },
      }));
    },
    []
  );

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
            id="showRecommendationReasons"
            label="Show Recommendation Reasons"
            description="Display explanations for why papers are recommended"
            checked={draft.showRecommendationReasons}
            onCheckedChange={(checked) => updateDraft({ showRecommendationReasons: checked })}
            disabled={isPending}
          />
        </div>

        {/* Related Papers Signals */}
        <CollapsibleSection title="Related Papers" icon={FileText}>
          <p className="text-sm text-muted-foreground mb-3">
            Configure what to show in the Related Papers panel on eprint pages.
          </p>

          <div className="space-y-1">
            <SettingToggle
              id="related-semantic"
              label="Semantic Similarity"
              description="Papers with similar meaning based on embeddings"
              icon={Brain}
              checked={draft.relatedPapersSignals.semantic ?? true}
              onCheckedChange={(checked) => updateDraftRelatedSignal('semantic', checked)}
              disabled={isPending}
            />

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
              checked={draft.relatedPapersSignals.authors ?? true}
              onCheckedChange={(checked) => updateDraftRelatedSignal('authors', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-cocitation"
              label="Co-Citation"
              description="Papers frequently cited together by other works"
              icon={Users}
              checked={draft.relatedPapersSignals.coCitation ?? false}
              onCheckedChange={(checked) => updateDraftRelatedSignal('coCitation', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-bibcoupling"
              label="Bibliographic Coupling"
              description="Papers that cite the same references"
              icon={GitBranch}
              checked={draft.relatedPapersSignals.bibliographicCoupling ?? false}
              onCheckedChange={(checked) =>
                updateDraftRelatedSignal('bibliographicCoupling', checked)
              }
              disabled={isPending}
            />

            <SettingToggle
              id="related-collaborative"
              label="Collaborative Filtering"
              description="Papers that other researchers with similar interests also read"
              icon={Shuffle}
              checked={draft.relatedPapersSignals.collaborative ?? false}
              onCheckedChange={(checked) => updateDraftRelatedSignal('collaborative', checked)}
              disabled={isPending}
            />
          </div>
        </CollapsibleSection>

        {/* Related Papers Weights */}
        <CollapsibleSection title="Related Papers Signal Weights" icon={SlidersHorizontal}>
          <p className="text-sm text-muted-foreground mb-3">
            Adjust the relative importance of each related papers signal.
          </p>

          <div className="space-y-2">
            <WeightSlider
              label="Semantic Similarity"
              icon={Brain}
              value={draft.relatedPapersWeights.semantic}
              onChange={(v) => updateDraftRelatedWeight('semantic', v)}
              disabled={isPending}
            />
            <WeightSlider
              label="Co-citation"
              icon={Quote}
              value={draft.relatedPapersWeights.coCitation}
              onChange={(v) => updateDraftRelatedWeight('coCitation', v)}
              disabled={isPending}
            />
            <WeightSlider
              label="Concept Overlap"
              icon={Tag}
              value={draft.relatedPapersWeights.conceptOverlap}
              onChange={(v) => updateDraftRelatedWeight('conceptOverlap', v)}
              disabled={isPending}
            />
            <WeightSlider
              label="Author Network"
              icon={Users}
              value={draft.relatedPapersWeights.authorNetwork}
              onChange={(v) => updateDraftRelatedWeight('authorNetwork', v)}
              disabled={isPending}
            />
            <WeightSlider
              label="Collaborative Filtering"
              icon={Shuffle}
              value={draft.relatedPapersWeights.collaborative}
              onChange={(v) => updateDraftRelatedWeight('collaborative', v)}
              disabled={isPending}
            />

            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() =>
                updateDraft({ relatedPapersWeights: { ...DEFAULT_RELATED_PAPERS_WEIGHTS } })
              }
              disabled={isPending}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to defaults
            </Button>
          </div>
        </CollapsibleSection>

        {/* Related Papers Thresholds */}
        <CollapsibleSection title="Related Papers Thresholds" icon={Filter}>
          <p className="text-sm text-muted-foreground mb-3">
            Control minimum quality and quantity for related papers.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Minimum Score</Label>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {draft.relatedPapersThresholds.minScore}%
                </span>
              </div>
              <Slider
                value={[draft.relatedPapersThresholds.minScore]}
                onValueChange={([v]) => updateDraftThreshold('minScore', v ?? 5)}
                min={0}
                max={50}
                step={1}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Papers below this combined score are filtered out. Lower values show more results.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Max Results</Label>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {draft.relatedPapersThresholds.maxResults}
                </span>
              </div>
              <Slider
                value={[draft.relatedPapersThresholds.maxResults]}
                onValueChange={([v]) => updateDraftThreshold('maxResults', v ?? 10)}
                min={1}
                max={50}
                step={1}
                disabled={isPending}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                updateDraft({
                  relatedPapersThresholds: { ...DEFAULT_RELATED_PAPERS_THRESHOLDS },
                })
              }
              disabled={isPending}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to defaults
            </Button>
          </div>
        </CollapsibleSection>

        {/* Trending Preferences */}
        <CollapsibleSection title="Trending Preferences" icon={TrendingUp}>
          <p className="text-sm text-muted-foreground mb-3">
            Configure defaults for the Trending page.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Default Time Window
              </Label>
              <RadioGroup
                value={draft.trendingPreferences.defaultWindow}
                onValueChange={(value) => updateDraftTrending('defaultWindow', value)}
                disabled={isPending}
                className="flex gap-4"
              >
                {(['24h', '7d', '30d'] as const).map((window) => (
                  <div key={window} className="flex items-center space-x-2">
                    <RadioGroupItem value={window} id={`trending-window-${window}`} />
                    <Label htmlFor={`trending-window-${window}`} className="cursor-pointer text-sm">
                      {window === '24h' ? '24 Hours' : window === '7d' ? '7 Days' : '30 Days'}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Default Results Count</Label>
                <span className="text-xs font-mono text-muted-foreground tabular-nums">
                  {draft.trendingPreferences.defaultLimit}
                </span>
              </div>
              <Slider
                value={[draft.trendingPreferences.defaultLimit]}
                onValueChange={([v]) => updateDraftTrending('defaultLimit', v ?? 20)}
                min={5}
                max={100}
                step={5}
                disabled={isPending}
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() =>
                updateDraft({ trendingPreferences: { ...DEFAULT_TRENDING_PREFERENCES } })
              }
              disabled={isPending}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to defaults
            </Button>
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
