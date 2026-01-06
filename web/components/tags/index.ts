/**
 * Tag components for user-contributed folksonomy tags.
 *
 * Tags are user-generated labels without pre-approval.
 * High-quality tags (low spam, multiple users) can be promoted
 * to facets or authorities through community voting.
 *
 * @example
 * ```tsx
 * import { TagList, TagInput, TagCloud } from '@/components/tags';
 *
 * // Display tags
 * <TagList tags={tags} linkToTags />
 *
 * // Add tags with autocomplete
 * <TagInput existingTags={tags} onTagAdd={handleAdd} />
 *
 * // Weighted tag cloud
 * <TagCloud tags={trendingTags} />
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// TAG CHIP
// =============================================================================

export { TagChip, TagChipWithQuality, TagChipSkeleton, type TagChipProps } from './tag-chip';

// =============================================================================
// TAG LIST
// =============================================================================

export { TagList, TagListSkeleton, type TagListProps } from './tag-list';

// =============================================================================
// TAG INPUT
// =============================================================================

export { TagInput, type TagInputProps } from './tag-input';

// =============================================================================
// TAG CLOUD
// =============================================================================

export { TagCloud, TagCloudSkeleton, type TagCloudProps } from './tag-cloud';

// =============================================================================
// TRENDING TAGS
// =============================================================================

export { TrendingTags, type TrendingTagsProps } from './trending-tags';

// =============================================================================
// TAG MANAGER
// =============================================================================

export { TagManager, type TagManagerProps } from './tag-manager';
