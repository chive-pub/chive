'use client';

import { useState } from 'react';
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
 */
export function DiscoverySettingsPanel() {
  const { data: settings, isLoading } = useDiscoverySettings();
  const { mutate: updateSettings, isPending } = useUpdateDiscoverySettings();

  // Use settings or defaults
  const currentSettings = settings ?? DEFAULT_DISCOVERY_SETTINGS;

  const handleToggle = (
    key: keyof typeof currentSettings,
    value: boolean | CitationNetworkDisplay
  ) => {
    updateSettings(
      { [key]: value },
      {
        onError: (error) => {
          toast.error('Failed to save', {
            description: error.message || 'Could not update discovery settings',
          });
        },
      }
    );
  };

  const handleForYouSignal = (
    signal: keyof typeof currentSettings.forYouSignals,
    value: boolean
  ) => {
    updateSettings(
      { forYouSignals: { [signal]: value } },
      {
        onError: (error) => {
          toast.error('Failed to save', {
            description: error.message || 'Could not update discovery settings',
          });
        },
      }
    );
  };

  const handleRelatedSignal = (
    signal: keyof typeof currentSettings.relatedPapersSignals,
    value: boolean
  ) => {
    updateSettings(
      { relatedPapersSignals: { [signal]: value } },
      {
        onError: (error) => {
          toast.error('Failed to save', {
            description: error.message || 'Could not update discovery settings',
          });
        },
      }
    );
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
            checked={currentSettings.enablePersonalization}
            onCheckedChange={(checked) => handleToggle('enablePersonalization', checked)}
            disabled={isPending}
          />

          <SettingToggle
            id="enableForYouFeed"
            label="Show For You Feed"
            description="Display personalized paper recommendations on your home page"
            checked={currentSettings.enableForYouFeed}
            onCheckedChange={(checked) => handleToggle('enableForYouFeed', checked)}
            disabled={isPending || !currentSettings.enablePersonalization}
          />

          <SettingToggle
            id="showRecommendationReasons"
            label="Show Recommendation Reasons"
            description="Display explanations for why papers are recommended"
            checked={currentSettings.showRecommendationReasons}
            onCheckedChange={(checked) => handleToggle('showRecommendationReasons', checked)}
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
              checked={currentSettings.forYouSignals.fields ?? true}
              onCheckedChange={(checked) => handleForYouSignal('fields', checked)}
              disabled={isPending || !currentSettings.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-citations"
              label="Citations"
              description="Papers citing or related to your work"
              icon={Quote}
              checked={currentSettings.forYouSignals.citations ?? true}
              onCheckedChange={(checked) => handleForYouSignal('citations', checked)}
              disabled={isPending || !currentSettings.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-collaborators"
              label="Collaborators"
              description="Papers from your co-authors and collaborators"
              icon={Users}
              checked={currentSettings.forYouSignals.collaborators ?? true}
              onCheckedChange={(checked) => handleForYouSignal('collaborators', checked)}
              disabled={isPending || !currentSettings.enableForYouFeed}
            />

            <SettingToggle
              id="forYou-trending"
              label="Trending"
              description="Popular papers in your fields"
              icon={TrendingUp}
              checked={currentSettings.forYouSignals.trending ?? true}
              onCheckedChange={(checked) => handleForYouSignal('trending', checked)}
              disabled={isPending || !currentSettings.enableForYouFeed}
            />
          </div>
        </CollapsibleSection>

        {/* Related Papers Signals */}
        <CollapsibleSection title="Related Papers" icon={FileText}>
          <p className="text-sm text-muted-foreground mb-3">
            Configure what to show in the Related Papers panel on preprint pages.
          </p>

          <div className="space-y-1">
            <SettingToggle
              id="related-citations"
              label="Citation Relationships"
              description="Papers that cite or are cited by this paper"
              icon={Quote}
              checked={currentSettings.relatedPapersSignals.citations ?? true}
              onCheckedChange={(checked) => handleRelatedSignal('citations', checked)}
              disabled={isPending}
            />

            <SettingToggle
              id="related-topics"
              label="Topic Similarity"
              description="Papers on similar topics and concepts"
              icon={Tag}
              checked={currentSettings.relatedPapersSignals.topics ?? true}
              onCheckedChange={(checked) => handleRelatedSignal('topics', checked)}
              disabled={isPending}
            />
          </div>
        </CollapsibleSection>

        {/* Citation Network Display */}
        <CollapsibleSection title="Citation Network Display" icon={Quote}>
          <p className="text-sm text-muted-foreground mb-3">
            How to display the citation network on preprint pages.
          </p>

          <RadioGroup
            value={currentSettings.citationNetworkDisplay}
            onValueChange={(value) =>
              handleToggle('citationNetworkDisplay', value as CitationNetworkDisplay)
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

        {/* Saving indicator */}
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
