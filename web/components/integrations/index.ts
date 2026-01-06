/**
 * Integration components for displaying plugin data.
 *
 * @remarks
 * These components display data from external integrations:
 * - GitHub/GitLab repository metadata
 * - Zenodo DOI badges
 * - Software Heritage archival status
 * - Dataset links (Figshare, Dryad, OSF)
 *
 * @packageDocumentation
 */

export { GitHubRepoCard, type GitHubRepoCardProps } from './github-repo-card';
export { GitLabProjectCard, type GitLabProjectCardProps } from './gitlab-project-card';
export { ZenodoBadge, type ZenodoBadgeProps } from './zenodo-badge';
export { SoftwareHeritageBadge, type SoftwareHeritageBadgeProps } from './software-heritage-badge';
export {
  DatasetLinks,
  DatasetLinkItem,
  type DatasetLinksProps,
  type DatasetLinkItemProps,
} from './dataset-links';
export {
  IntegrationPanel,
  IntegrationPanelSkeleton,
  type IntegrationPanelProps,
} from './integration-panel';
