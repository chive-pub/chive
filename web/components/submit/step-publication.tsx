'use client';

/**
 * Publication metadata step for eprint submission.
 *
 * @remarks
 * Handles comprehensive publication metadata including:
 * - Publication status
 * - Published version linking
 * - External identifiers (arXiv, PMID, SSRN, etc.)
 * - Code and data repositories
 * - Funding information
 * - Conference presentation
 *
 * @packageDocumentation
 */

import { useCallback } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import {
  BookOpen,
  ExternalLink,
  Github,
  Database,
  DollarSign,
  Calendar,
  Plus,
  X,
  Globe,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DoiAutocomplete,
  FunderAutocomplete,
  ArxivAutocomplete,
  PubmedAutocomplete,
  ConferenceAutocomplete,
  ConceptAutocomplete,
  type CrossRefWork,
  type CrossRefFunder,
  type ArxivEntry,
  type PubmedEntry,
  type Conference,
  type ConceptSuggestion,
} from '@/components/forms';
import type { EprintFormValues } from './submission-wizard';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for StepPublication component.
 */
export interface StepPublicationProps {
  /** React Hook Form instance */
  form: UseFormReturn<EprintFormValues>;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Publication status options.
 */
const PUBLICATION_STATUS_OPTIONS = [
  { value: 'eprint', label: 'Eprint' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_press', label: 'In Press' },
  { value: 'published', label: 'Published' },
  { value: 'retracted', label: 'Retracted' },
] as const;

// Platform and presentation type options are now sourced from the knowledge graph
// via ConceptAutocomplete with category constraints:
// - Code platforms: category='platform-code'
// - Data repositories: category='platform-data'
// - Preregistration: category='platform-preregistration'
// - Presentation types: category='presentation-type'

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Publication metadata step component.
 *
 * @param props - Component props
 * @returns Publication metadata step element
 */
export function StepPublication({ form, className }: StepPublicationProps) {
  // Field arrays for repeatable sections
  const codeReposArray = useFieldArray({
    control: form.control,
    name: 'codeRepositories',
  });

  const dataReposArray = useFieldArray({
    control: form.control,
    name: 'dataRepositories',
  });

  const fundingArray = useFieldArray({
    control: form.control,
    name: 'funding',
  });

  // Add code repository
  const handleAddCodeRepo = useCallback(() => {
    codeReposArray.append({
      url: '',
      platformUri: '',
      platformName: '',
      label: '',
    });
  }, [codeReposArray]);

  // Add data repository
  const handleAddDataRepo = useCallback(() => {
    dataReposArray.append({
      url: '',
      platformUri: '',
      platformName: '',
      label: '',
    });
  }, [dataReposArray]);

  // Handle code platform selection
  const handleCodePlatformSelect = useCallback(
    (concept: ConceptSuggestion, index: number) => {
      form.setValue(`codeRepositories.${index}.platformUri`, concept.uri, { shouldValidate: true });
      form.setValue(`codeRepositories.${index}.platformName`, concept.name, {
        shouldValidate: true,
      });
    },
    [form]
  );

  // Handle code platform clear
  const handleCodePlatformClear = useCallback(
    (index: number) => {
      form.setValue(`codeRepositories.${index}.platformUri`, '', { shouldValidate: true });
      form.setValue(`codeRepositories.${index}.platformName`, '', { shouldValidate: true });
    },
    [form]
  );

  // Handle data platform selection
  const handleDataPlatformSelect = useCallback(
    (concept: ConceptSuggestion, index: number) => {
      form.setValue(`dataRepositories.${index}.platformUri`, concept.uri, { shouldValidate: true });
      form.setValue(`dataRepositories.${index}.platformName`, concept.name, {
        shouldValidate: true,
      });
    },
    [form]
  );

  // Handle data platform clear
  const handleDataPlatformClear = useCallback(
    (index: number) => {
      form.setValue(`dataRepositories.${index}.platformUri`, '', { shouldValidate: true });
      form.setValue(`dataRepositories.${index}.platformName`, '', { shouldValidate: true });
    },
    [form]
  );

  // Handle preregistration platform selection
  const handlePreregPlatformSelect = useCallback(
    (concept: ConceptSuggestion) => {
      form.setValue('preregistration.platformUri', concept.uri, { shouldValidate: true });
      form.setValue('preregistration.platformName', concept.name, { shouldValidate: true });
    },
    [form]
  );

  // Handle preregistration platform clear
  const handlePreregPlatformClear = useCallback(() => {
    form.setValue('preregistration.platformUri', '', { shouldValidate: true });
    form.setValue('preregistration.platformName', '', { shouldValidate: true });
  }, [form]);

  // Handle presentation type selection
  const handlePresentationTypeSelect = useCallback(
    (concept: ConceptSuggestion) => {
      form.setValue('conferencePresentation.presentationTypeUri', concept.uri, {
        shouldValidate: true,
      });
      form.setValue('conferencePresentation.presentationTypeName', concept.name, {
        shouldValidate: true,
      });
    },
    [form]
  );

  // Handle presentation type clear
  const handlePresentationTypeClear = useCallback(() => {
    form.setValue('conferencePresentation.presentationTypeUri', '', { shouldValidate: true });
    form.setValue('conferencePresentation.presentationTypeName', '', { shouldValidate: true });
  }, [form]);

  // Add funding source
  const handleAddFunding = useCallback(() => {
    fundingArray.append({
      funderName: '',
      grantNumber: '',
    });
  }, [fundingArray]);

  // Handle DOI selection with auto-fill
  const handleDoiSelect = useCallback(
    (work: CrossRefWork) => {
      form.setValue('publishedVersion.doi', work.doi, { shouldValidate: true });
      if (work.url) {
        form.setValue('publishedVersion.url', work.url, { shouldValidate: true });
      } else {
        form.setValue('publishedVersion.url', `https://doi.org/${work.doi}`, {
          shouldValidate: true,
        });
      }
      if (work.journal) {
        form.setValue('publishedVersion.journal', work.journal, { shouldValidate: true });
      }
      if (work.publisher) {
        form.setValue('publishedVersion.publisher', work.publisher, { shouldValidate: true });
      }
    },
    [form]
  );

  // Handle DOI clear
  const handleDoiClear = useCallback(() => {
    form.setValue('publishedVersion.doi', '', { shouldValidate: true });
  }, [form]);

  // Handle funder selection with auto-fill
  const handleFunderSelect = useCallback(
    (funder: CrossRefFunder, index: number) => {
      form.setValue(`funding.${index}.funderName`, funder.name, { shouldValidate: true });
    },
    [form]
  );

  // Handle arXiv selection
  const handleArxivSelect = useCallback(
    (entry: ArxivEntry) => {
      form.setValue('externalIds.arxivId', entry.id, { shouldValidate: true });
    },
    [form]
  );

  // Handle arXiv clear
  const handleArxivClear = useCallback(() => {
    form.setValue('externalIds.arxivId', '', { shouldValidate: true });
  }, [form]);

  // Handle PubMed selection
  const handlePubmedSelect = useCallback(
    (entry: PubmedEntry) => {
      form.setValue('externalIds.pmid', entry.pmid, { shouldValidate: true });
    },
    [form]
  );

  // Handle PubMed clear
  const handlePubmedClear = useCallback(() => {
    form.setValue('externalIds.pmid', '', { shouldValidate: true });
  }, [form]);

  // Handle conference selection
  const handleConferenceSelect = useCallback(
    (conference: Conference) => {
      form.setValue('conferencePresentation.conferenceName', conference.name, {
        shouldValidate: true,
      });
      if (conference.url) {
        form.setValue('conferencePresentation.conferenceUrl', conference.url, {
          shouldValidate: true,
        });
      }
    },
    [form]
  );

  // Handle conference clear
  const handleConferenceClear = useCallback(() => {
    form.setValue('conferencePresentation.conferenceName', '', { shouldValidate: true });
  }, [form]);

  return (
    <div className={cn('space-y-8', className)}>
      {/* Publication Status */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Publication Status
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Current status in the publication lifecycle.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="publicationStatus">Status</Label>
            <Select
              value={form.watch('publicationStatus') ?? 'eprint'}
              onValueChange={(value) =>
                form.setValue(
                  'publicationStatus',
                  value as (typeof PUBLICATION_STATUS_OPTIONS)[number]['value']
                )
              }
            >
              <SelectTrigger id="publicationStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {PUBLICATION_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Published Version */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Published Version
            <span className="text-sm font-normal text-muted-foreground">(if applicable)</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Link to the published version (Version of Record) if this eprint has been published.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="publishedDoi">DOI</Label>
            <DoiAutocomplete
              id="publishedDoi"
              value={form.watch('publishedVersion.doi')}
              placeholder="Search by title or DOI..."
              onSelect={handleDoiSelect}
              onClear={handleDoiClear}
            />
            <p className="text-xs text-muted-foreground">
              Search for a publication to auto-fill journal and publisher details.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishedUrl">URL</Label>
            <Input
              id="publishedUrl"
              type="url"
              placeholder="https://..."
              {...form.register('publishedVersion.url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="journal">Journal</Label>
            <Input
              id="journal"
              placeholder="Journal name"
              {...form.register('publishedVersion.journal')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publisher">Publisher</Label>
            <Input
              id="publisher"
              placeholder="Publisher name"
              {...form.register('publishedVersion.publisher')}
            />
          </div>
        </div>
      </section>

      {/* External Identifiers */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5" />
            External Identifiers
            <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Link to other eprint servers or databases where this work is indexed.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="arxivId">arXiv ID</Label>
            <ArxivAutocomplete
              id="arxivId"
              value={form.watch('externalIds.arxivId')}
              placeholder="Search by title or arXiv ID..."
              onSelect={handleArxivSelect}
              onClear={handleArxivClear}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pmid">PubMed ID</Label>
            <PubmedAutocomplete
              id="pmid"
              value={form.watch('externalIds.pmid')}
              placeholder="Search by title or PMID..."
              onSelect={handlePubmedSelect}
              onClear={handlePubmedClear}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ssrnId">SSRN ID</Label>
            <Input id="ssrnId" placeholder="1234567" {...form.register('externalIds.ssrnId')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="osf">OSF ID</Label>
            <Input id="osf" placeholder="abc12" {...form.register('externalIds.osf')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zenodoDoi">Zenodo DOI</Label>
            <Input
              id="zenodoDoi"
              placeholder="10.5281/zenodo.1234567"
              {...form.register('externalIds.zenodoDoi')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="openAlexId">OpenAlex ID</Label>
            <Input
              id="openAlexId"
              placeholder="W1234567890"
              {...form.register('externalIds.openAlexId')}
            />
          </div>
        </div>
      </section>

      {/* Code Repositories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Github className="h-5 w-5" />
              Code Repositories
              <span className="text-sm font-normal text-muted-foreground">(optional)</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Link to code repositories for reproducibility.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddCodeRepo}>
            <Plus className="h-4 w-4 mr-1" />
            Add Repository
          </Button>
        </div>

        {codeReposArray.fields.length > 0 && (
          <div className="space-y-4">
            {codeReposArray.fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`codeRepo-url-${index}`}>URL</Label>
                    <Input
                      id={`codeRepo-url-${index}`}
                      type="url"
                      placeholder="https://github.com/..."
                      {...form.register(`codeRepositories.${index}.url`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`codeRepo-platform-${index}`}>Platform</Label>
                    <ConceptAutocomplete
                      id={`codeRepo-platform-${index}`}
                      category="platform-code"
                      value={form.watch(`codeRepositories.${index}.platformUri`)}
                      onSelect={(concept) => handleCodePlatformSelect(concept, index)}
                      onClear={() => handleCodePlatformClear(index)}
                      placeholder="Search platforms..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`codeRepo-label-${index}`}>Label</Label>
                    <Input
                      id={`codeRepo-label-${index}`}
                      placeholder="Analysis code"
                      {...form.register(`codeRepositories.${index}.label`)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => codeReposArray.remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Repositories */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Repositories
              <span className="text-sm font-normal text-muted-foreground">(optional)</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Link to datasets and data repositories.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddDataRepo}>
            <Plus className="h-4 w-4 mr-1" />
            Add Repository
          </Button>
        </div>

        {dataReposArray.fields.length > 0 && (
          <div className="space-y-4">
            {dataReposArray.fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`dataRepo-url-${index}`}>URL</Label>
                    <Input
                      id={`dataRepo-url-${index}`}
                      type="url"
                      placeholder="https://zenodo.org/..."
                      {...form.register(`dataRepositories.${index}.url`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`dataRepo-platform-${index}`}>Platform</Label>
                    <ConceptAutocomplete
                      id={`dataRepo-platform-${index}`}
                      category="platform-data"
                      value={form.watch(`dataRepositories.${index}.platformUri`)}
                      onSelect={(concept) => handleDataPlatformSelect(concept, index)}
                      onClear={() => handleDataPlatformClear(index)}
                      placeholder="Search data repositories..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`dataRepo-label-${index}`}>Label</Label>
                    <Input
                      id={`dataRepo-label-${index}`}
                      placeholder="Raw data"
                      {...form.register(`dataRepositories.${index}.label`)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => dataReposArray.remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pre-registration */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Pre-registration
            <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Link to pre-registration or registered report.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="preregUrl">URL</Label>
            <Input
              id="preregUrl"
              type="url"
              placeholder="https://osf.io/..."
              {...form.register('preregistration.url')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preregPlatform">Platform</Label>
            <ConceptAutocomplete
              id="preregPlatform"
              category="platform-preregistration"
              value={form.watch('preregistration.platformUri')}
              onSelect={handlePreregPlatformSelect}
              onClear={handlePreregPlatformClear}
              placeholder="Search preregistration platforms..."
            />
          </div>
        </div>
      </section>

      {/* Funding */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Funding Sources
              <span className="text-sm font-normal text-muted-foreground">(optional)</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Acknowledge funding sources and grants.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddFunding}>
            <Plus className="h-4 w-4 mr-1" />
            Add Funding
          </Button>
        </div>

        {fundingArray.fields.length > 0 && (
          <div className="space-y-4">
            {fundingArray.fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start p-4 border rounded-lg">
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`funding-funder-${index}`}>Funder Name</Label>
                    <FunderAutocomplete
                      id={`funding-funder-${index}`}
                      value={form.watch(`funding.${index}.funderName`)}
                      placeholder="Search funding organizations..."
                      onSelect={(funder) => handleFunderSelect(funder, index)}
                      onClear={() => form.setValue(`funding.${index}.funderName`, '')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`funding-grant-${index}`}>Grant Number</Label>
                    <Input
                      id={`funding-grant-${index}`}
                      placeholder="R01-GM123456"
                      {...form.register(`funding.${index}.grantNumber`)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fundingArray.remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Conference Presentation */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Conference Presentation
            <span className="text-sm font-normal text-muted-foreground">(optional)</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Conference where this work was presented.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="conferenceName">Conference Name</Label>
            <ConferenceAutocomplete
              id="conferenceName"
              value={form.watch('conferencePresentation.conferenceName')}
              placeholder="Search conferences (e.g., NeurIPS, ICML)..."
              onSelect={handleConferenceSelect}
              onClear={handleConferenceClear}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conferenceLocation">Location</Label>
            <Input
              id="conferenceLocation"
              placeholder="Vancouver, Canada"
              {...form.register('conferencePresentation.conferenceLocation')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="presentationType">Presentation Type</Label>
            <ConceptAutocomplete
              id="presentationType"
              category="presentation-type"
              value={form.watch('conferencePresentation.presentationTypeUri')}
              onSelect={handlePresentationTypeSelect}
              onClear={handlePresentationTypeClear}
              placeholder="Search presentation types..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="conferenceUrl">Conference URL</Label>
            <Input
              id="conferenceUrl"
              type="url"
              placeholder="https://..."
              {...form.register('conferencePresentation.conferenceUrl')}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
