/**
 * Shared form components for Chive.
 *
 * @remarks
 * Provides reusable form components for eprint submission,
 * governance proposals, and other forms.
 *
 * @packageDocumentation
 */

export { FieldSearch, type FieldSearchProps, type FieldSelection } from './field-search';

export { AuthorInput, type AuthorInputProps, type AuthorRef } from './author-input';

export {
  FileDropzone,
  type FileDropzoneProps,
  type SelectedFile,
  type AcceptedFileTypes,
} from './file-dropzone';

// Autocomplete components
export {
  AutocompleteInput,
  type AutocompleteInputProps,
  useAutocompleteSearch,
} from './autocomplete-input';

export {
  DoiAutocomplete,
  type DoiAutocompleteProps,
  type CrossRefWork,
  useExtractPublicationMetadata,
} from './doi-autocomplete';

export {
  FunderAutocomplete,
  type FunderAutocompleteProps,
  type CrossRefFunder,
} from './funder-autocomplete';

export {
  JournalAutocomplete,
  type JournalAutocompleteProps,
  type CrossRefJournal,
} from './journal-autocomplete';

export {
  OrcidAutocomplete,
  type OrcidAutocompleteProps,
  type OrcidPerson,
} from './orcid-autocomplete';

export {
  ArxivAutocomplete,
  type ArxivAutocompleteProps,
  type ArxivEntry,
} from './arxiv-autocomplete';

export {
  PubmedAutocomplete,
  type PubmedAutocompleteProps,
  type PubmedEntry,
} from './pubmed-autocomplete';

export {
  GithubRepoAutocomplete,
  type GithubRepoAutocompleteProps,
  type GithubRepo,
} from './github-repo-autocomplete';

export {
  ZenodoAutocomplete,
  type ZenodoAutocompleteProps,
  type ZenodoRecord,
  type ZenodoRecordType,
} from './zenodo-autocomplete';

export {
  ConferenceAutocomplete,
  type ConferenceAutocompleteProps,
  type Conference,
} from './conference-autocomplete';

export {
  AffiliationInput,
  type AffiliationInputProps,
  type AuthorAffiliation,
} from './affiliation-input';

export {
  ContributionTypeSelector,
  type ContributionTypeSelectorProps,
  type ContributionType,
  type SelectedContribution,
  type ContributionDegree,
} from './contribution-type-selector';

export {
  EprintAuthorEditor,
  type EprintAuthorEditorProps,
  type EprintAuthorFormData,
} from './eprint-author-editor';

// External identifier autocomplete components
export {
  LcshAutocomplete,
  type LcshAutocompleteProps,
  type LcshSuggestion,
} from './lcsh-autocomplete';

export {
  CreditAutocomplete,
  type CreditAutocompleteProps,
  type CreditRole,
  CREDIT_ROLES,
  getCreditRoleByUri,
  getCreditRoleById,
} from './credit-autocomplete';

export {
  FastAutocomplete,
  type FastAutocompleteProps,
  type FastSuggestion,
} from './fast-autocomplete';

export {
  FacetAutocomplete,
  type FacetAutocompleteProps,
  type FacetSuggestion,
} from './facet-autocomplete';

export {
  ConceptAutocomplete,
  type ConceptAutocompleteProps,
  type ConceptSuggestion,
  type ConceptCategory,
  type ConceptStatus,
} from './concept-autocomplete';
