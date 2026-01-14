'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Save,
  Plus,
  X,
  User,
  Building,
  Tag,
  Link2,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMyChiveProfile, useUpdateChiveProfile } from '@/lib/hooks/use-author';
import type { Affiliation, ResearchKeyword } from '@/lib/api/schema';
import type { UpdateChiveProfileInput } from '@/lib/atproto/record-creator';
import { AffiliationAutocompleteInput } from './affiliation-autocomplete-input';
import { KeywordAutocompleteInput } from './keyword-autocomplete-input';
import { OrcidAutocompleteInput } from './orcid-autocomplete-input';
import { AuthorIdAutocompleteInput } from './author-id-autocomplete-input';

/**
 * Converts API affiliations (may be string[] or structured) to structured format.
 */
function normalizeAffiliations(
  input: Array<string | { name: string; rorId?: string }> | undefined
): Affiliation[] {
  if (!input) return [];
  return input.map((item) => {
    if (typeof item === 'string') {
      return { name: item };
    }
    return { name: item.name, rorId: item.rorId };
  });
}

/**
 * Converts API keywords (may be string[] or structured) to structured format.
 */
function normalizeKeywords(
  input: Array<string | { label: string; fastId?: string; wikidataId?: string }> | undefined
): ResearchKeyword[] {
  if (!input) return [];
  return input.map((item) => {
    if (typeof item === 'string') {
      return { label: item };
    }
    return { label: item.label, fastId: item.fastId, wikidataId: item.wikidataId };
  });
}

/**
 * Affiliation schema for form validation.
 */
const affiliationSchema = z.object({
  name: z.string().max(200),
  rorId: z.string().max(50).optional(),
});

/**
 * Research keyword schema for form validation.
 */
const keywordSchema = z.object({
  label: z.string().max(100),
  fastId: z.string().max(20).optional(),
  wikidataId: z.string().max(20).optional(),
});

/**
 * Form schema for Chive profile editing.
 */
const profileFormSchema = z.object({
  displayName: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  orcid: z
    .string()
    .regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, 'Invalid ORCID format')
    .optional()
    .or(z.literal('')),
  affiliations: z.array(affiliationSchema).max(10).optional(),
  nameVariants: z.array(z.string().max(200)).max(20).optional(),
  previousAffiliations: z.array(affiliationSchema).max(20).optional(),
  researchKeywords: z.array(keywordSchema).max(50).optional(),
  semanticScholarId: z.string().max(50).optional(),
  openAlexId: z.string().max(50).optional(),
  googleScholarId: z.string().max(50).optional(),
  openReviewId: z.string().max(100).optional(),
  dblpId: z.string().max(200).optional(),
  scopusAuthorId: z.string().max(50).optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

/**
 * Multi-value input component for string array fields.
 */
function MultiValueInput({
  label,
  values,
  onChange,
  placeholder,
  maxItems,
  description,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  description?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addValue = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !values.includes(trimmed)) {
      if (!maxItems || values.length < maxItems) {
        onChange([...values, trimmed]);
        setInputValue('');
      }
    }
  };

  const removeValue = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addValue();
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addValue}
          disabled={!inputValue.trim() || (maxItems !== undefined && values.length >= maxItems)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((value, index) => (
            <Badge key={index} variant="secondary" className="gap-1">
              {value}
              <button
                type="button"
                onClick={() => removeValue(index)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {maxItems && (
        <p className="text-xs text-muted-foreground">
          {values.length}/{maxItems} items
        </p>
      )}
    </div>
  );
}

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
 * Chive Profile settings form component.
 *
 * @remarks
 * Allows users to edit their Chive-specific profile fields including
 * name variants, research keywords, and external authority IDs.
 */
export function ChiveProfileForm() {
  const { data: existingProfile, isLoading } = useMyChiveProfile();
  const { mutate: updateProfile, isPending } = useUpdateChiveProfile();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: '',
      bio: '',
      orcid: '',
      affiliations: [],
      nameVariants: [],
      previousAffiliations: [],
      researchKeywords: [],
      semanticScholarId: '',
      openAlexId: '',
      googleScholarId: '',
      openReviewId: '',
      dblpId: '',
      scopusAuthorId: '',
    },
  });

  // Load existing profile data into form
  useEffect(() => {
    if (existingProfile) {
      // Handle both old (string[]) and new (structured) formats from API
      const profile = existingProfile as {
        displayName?: string;
        bio?: string;
        orcid?: string;
        affiliations?: Array<string | { name: string; rorId?: string }>;
        nameVariants?: string[];
        previousAffiliations?: Array<string | { name: string; rorId?: string }>;
        researchKeywords?: Array<string | { label: string; fastId?: string; wikidataId?: string }>;
        semanticScholarId?: string;
        openAlexId?: string;
        googleScholarId?: string;
        openReviewId?: string;
        dblpId?: string;
        scopusAuthorId?: string;
      };

      form.reset({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        orcid: profile.orcid ?? '',
        affiliations: normalizeAffiliations(profile.affiliations),
        nameVariants: profile.nameVariants ?? [],
        previousAffiliations: normalizeAffiliations(profile.previousAffiliations),
        researchKeywords: normalizeKeywords(profile.researchKeywords),
        semanticScholarId: profile.semanticScholarId ?? '',
        openAlexId: profile.openAlexId ?? '',
        googleScholarId: profile.googleScholarId ?? '',
        openReviewId: profile.openReviewId ?? '',
        dblpId: profile.dblpId ?? '',
        scopusAuthorId: profile.scopusAuthorId ?? '',
      });
    }
  }, [existingProfile, form]);

  const onSubmit = (data: ProfileFormData) => {
    // Convert empty strings to undefined and send structured types
    const cleanedData: UpdateChiveProfileInput = {
      displayName: data.displayName || undefined,
      bio: data.bio || undefined,
      orcid: data.orcid || undefined,
      affiliations: data.affiliations?.length ? data.affiliations : undefined,
      nameVariants: data.nameVariants?.length ? data.nameVariants : undefined,
      previousAffiliations: data.previousAffiliations?.length
        ? data.previousAffiliations
        : undefined,
      researchKeywords: data.researchKeywords?.length ? data.researchKeywords : undefined,
      semanticScholarId: data.semanticScholarId || undefined,
      openAlexId: data.openAlexId || undefined,
      googleScholarId: data.googleScholarId || undefined,
      openReviewId: data.openReviewId || undefined,
      dblpId: data.dblpId || undefined,
      scopusAuthorId: data.scopusAuthorId || undefined,
    };

    updateProfile(cleanedData, {
      onSuccess: () => {
        toast.success('Profile updated', {
          description: 'Your Chive profile has been saved.',
        });
      },
      onError: (error) => {
        toast.error('Error', {
          description: error.message || 'Failed to update profile',
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Chive Academic Profile
        </CardTitle>
        <CardDescription>
          Configure your academic profile for paper matching and discovery. This data helps Chive
          suggest papers you may have authored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your name as it appears on papers"
                {...form.register('displayName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Brief academic bio"
                rows={3}
                {...form.register('bio')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orcid">ORCID</Label>
              <Input id="orcid" placeholder="0000-0002-1825-0097" {...form.register('orcid')} />
              {form.formState.errors.orcid && (
                <p className="text-sm text-destructive">{form.formState.errors.orcid.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Name Variants Section */}
            <CollapsibleSection title="Name Variants" icon={User} defaultOpen>
              <p className="text-sm text-muted-foreground">
                Add alternative forms of your name that may appear on papers (maiden names,
                transliterations, initials like &quot;J. Smith&quot;).
              </p>
              <MultiValueInput
                label="Name Variants"
                values={form.watch('nameVariants') ?? []}
                onChange={(values) => form.setValue('nameVariants', values)}
                placeholder="e.g., J. A. Smith"
                maxItems={20}
              />
            </CollapsibleSection>

            {/* Affiliations Section */}
            <CollapsibleSection title="Affiliations" icon={Building}>
              <AffiliationAutocompleteInput
                label="Current Affiliations"
                values={form.watch('affiliations') ?? []}
                onChange={(values) => form.setValue('affiliations', values)}
                placeholder="Search institutions..."
                maxItems={10}
                description="Search ROR for your current institutional affiliations"
              />
              <AffiliationAutocompleteInput
                label="Previous Affiliations"
                values={form.watch('previousAffiliations') ?? []}
                onChange={(values) => form.setValue('previousAffiliations', values)}
                placeholder="Search institutions..."
                maxItems={20}
                description="Past affiliations that may appear on older papers"
              />
            </CollapsibleSection>

            {/* Research Keywords Section */}
            <CollapsibleSection title="Research Keywords" icon={Tag}>
              <KeywordAutocompleteInput
                label="Research Keywords"
                values={form.watch('researchKeywords') ?? []}
                onChange={(values) => form.setValue('researchKeywords', values)}
                placeholder="Search keywords..."
                maxItems={50}
                description="Search FAST & Wikidata for standardized research keywords"
              />
            </CollapsibleSection>

            {/* External IDs Section */}
            <CollapsibleSection title="External Authority IDs" icon={Link2}>
              <p className="text-sm text-muted-foreground mb-4">
                Link your profiles from academic databases for better paper matching. Search by name
                to find your profiles automatically.
              </p>

              {/* ORCID with autocomplete */}
              <OrcidAutocompleteInput
                value={form.watch('orcid') ?? ''}
                onChange={(value) => form.setValue('orcid', value || undefined)}
                className="mb-4"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Semantic Scholar with autocomplete */}
                <AuthorIdAutocompleteInput
                  idType="semanticScholar"
                  value={form.watch('semanticScholarId') ?? ''}
                  onChange={(value) => form.setValue('semanticScholarId', value || undefined)}
                  displayName={form.watch('displayName')}
                />

                {/* OpenAlex with autocomplete */}
                <AuthorIdAutocompleteInput
                  idType="openAlex"
                  value={form.watch('openAlexId') ?? ''}
                  onChange={(value) => form.setValue('openAlexId', value || undefined)}
                  displayName={form.watch('displayName')}
                />

                {/* DBLP with autocomplete */}
                <AuthorIdAutocompleteInput
                  idType="dblp"
                  value={form.watch('dblpId') ?? ''}
                  onChange={(value) => form.setValue('dblpId', value || undefined)}
                  displayName={form.watch('displayName')}
                />

                {/* Google Scholar with URL extraction */}
                <AuthorIdAutocompleteInput
                  idType="googleScholar"
                  value={form.watch('googleScholarId') ?? ''}
                  onChange={(value) => form.setValue('googleScholarId', value || undefined)}
                />

                {/* OpenReview with URL extraction */}
                <AuthorIdAutocompleteInput
                  idType="openReview"
                  value={form.watch('openReviewId') ?? ''}
                  onChange={(value) => form.setValue('openReviewId', value || undefined)}
                />

                {/* Scopus with URL extraction */}
                <AuthorIdAutocompleteInput
                  idType="scopus"
                  value={form.watch('scopusAuthorId') ?? ''}
                  onChange={(value) => form.setValue('scopusAuthorId', value || undefined)}
                />
              </div>
            </CollapsibleSection>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
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
        </form>
      </CardContent>
    </Card>
  );
}
