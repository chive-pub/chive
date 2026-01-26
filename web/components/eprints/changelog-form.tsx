'use client';

/**
 * Structured changelog form for eprint version updates.
 *
 * @remarks
 * Provides a form for creating structured changelogs when updating eprints.
 * Follows the pub.chive.eprint.changelog lexicon structure with sections
 * organized by category and individual change items within each section.
 *
 * @packageDocumentation
 */

import { ChevronDown, MessageSquare, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Known category values for changelog sections.
 */
export const CHANGELOG_CATEGORIES = [
  'methodology',
  'results',
  'analysis',
  'discussion',
  'conclusions',
  'data',
  'figures',
  'tables',
  'references',
  'supplementary-materials',
  'corrections',
  'formatting',
  'language-editing',
  'acknowledgments',
  'authorship',
  'other',
] as const;

/**
 * Changelog category type.
 */
export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

/**
 * Known change type values.
 */
export const CHANGE_TYPES = ['added', 'changed', 'removed', 'fixed', 'deprecated'] as const;

/**
 * Change type for individual items.
 */
export type ChangeType = (typeof CHANGE_TYPES)[number];

/**
 * Individual change item within a section.
 */
export interface ChangelogItem {
  /** Description of the change (required, max 2000 chars) */
  description: string;
  /** Type of change (optional) */
  changeType?: ChangeType;
  /** Location in document, e.g., "Section 3.2" or "Figure 5" (optional, max 100 chars) */
  location?: string;
  /** Reference to reviewer comment being addressed (optional, max 200 chars) */
  reviewReference?: string;
}

/**
 * Section of changes grouped by category.
 */
export interface ChangelogSection {
  /** Category of changes (kebab-case) */
  category: ChangelogCategory;
  /** Individual change items in this section */
  items: ChangelogItem[];
}

/**
 * Complete changelog form data structure.
 */
export interface ChangelogFormData {
  /** One-line summary of changes (max 500 chars) */
  summary?: string;
  /** Structured changelog sections */
  sections: ChangelogSection[];
  /** Response to peer review feedback (optional, max 10000 chars) */
  reviewerResponse?: string;
}

/**
 * Props for ChangelogForm.
 */
export interface ChangelogFormProps {
  /** Current form value */
  value: ChangelogFormData;
  /** Callback when form value changes */
  onChange: (value: ChangelogFormData) => void;
  /** Whether to show reviewer reference fields (for responding to peer review) */
  showReviewFields?: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Human-readable labels for categories.
 */
const CATEGORY_LABELS: Record<ChangelogCategory, string> = {
  methodology: 'Methodology',
  results: 'Results',
  analysis: 'Analysis',
  discussion: 'Discussion',
  conclusions: 'Conclusions',
  data: 'Data',
  figures: 'Figures',
  tables: 'Tables',
  references: 'References',
  'supplementary-materials': 'Supplementary Materials',
  corrections: 'Corrections',
  formatting: 'Formatting',
  'language-editing': 'Language Editing',
  acknowledgments: 'Acknowledgments',
  authorship: 'Authorship',
  other: 'Other',
};

/**
 * Human-readable labels for change types.
 */
const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  changed: 'Changed',
  removed: 'Removed',
  fixed: 'Fixed',
  deprecated: 'Deprecated',
};

/**
 * Creates an empty changelog item.
 */
function createEmptyItem(): ChangelogItem {
  return {
    description: '',
  };
}

/**
 * Creates an empty changelog section with the given category.
 *
 * @param category - the category for the new section
 * @returns a new changelog section with one empty item
 */
function createEmptySection(category: ChangelogCategory): ChangelogSection {
  return {
    category,
    items: [createEmptyItem()],
  };
}

/**
 * Structured changelog form component.
 *
 * @param props - component props
 * @param props.value - current form data
 * @param props.onChange - callback invoked when form data changes
 * @param props.showReviewFields - whether to show review reference fields
 * @param props.disabled - whether the form is disabled
 * @param props.className - additional CSS class name
 * @returns React element rendering the changelog form
 *
 * @example
 * ```tsx
 * const [changelog, setChangelog] = useState<ChangelogFormData>({
 *   summary: '',
 *   sections: [],
 * });
 *
 * <ChangelogForm
 *   value={changelog}
 *   onChange={setChangelog}
 *   showReviewFields={isRespondingToReview}
 * />
 * ```
 */
export function ChangelogForm({
  value,
  onChange,
  showReviewFields = false,
  disabled = false,
  className,
}: ChangelogFormProps) {
  const [reviewerResponseOpen, setReviewerResponseOpen] = React.useState(
    Boolean(value.reviewerResponse)
  );

  // Get categories that are not already in use
  const availableCategories = CHANGELOG_CATEGORIES.filter(
    (category) => !value.sections.some((section) => section.category === category)
  );

  const handleSummaryChange = (summary: string) => {
    onChange({ ...value, summary: summary || undefined });
  };

  const handleReviewerResponseChange = (reviewerResponse: string) => {
    onChange({ ...value, reviewerResponse: reviewerResponse || undefined });
  };

  const handleAddSection = (category: ChangelogCategory) => {
    onChange({
      ...value,
      sections: [...value.sections, createEmptySection(category)],
    });
  };

  const handleRemoveSection = (sectionIndex: number) => {
    onChange({
      ...value,
      sections: value.sections.filter((_, index) => index !== sectionIndex),
    });
  };

  const handleAddItem = (sectionIndex: number) => {
    const newSections = [...value.sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      items: [...newSections[sectionIndex].items, createEmptyItem()],
    };
    onChange({ ...value, sections: newSections });
  };

  const handleRemoveItem = (sectionIndex: number, itemIndex: number) => {
    const newSections = [...value.sections];
    const section = newSections[sectionIndex];

    // If this is the last item, remove the entire section
    if (section.items.length === 1) {
      handleRemoveSection(sectionIndex);
      return;
    }

    newSections[sectionIndex] = {
      ...section,
      items: section.items.filter((_, index) => index !== itemIndex),
    };
    onChange({ ...value, sections: newSections });
  };

  const handleItemChange = (
    sectionIndex: number,
    itemIndex: number,
    field: keyof ChangelogItem,
    fieldValue: string | undefined
  ) => {
    const newSections = [...value.sections];
    const section = newSections[sectionIndex];
    const newItems = [...section.items];

    newItems[itemIndex] = {
      ...newItems[itemIndex],
      [field]: fieldValue || undefined,
    };

    newSections[sectionIndex] = { ...section, items: newItems };
    onChange({ ...value, sections: newSections });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary */}
      <div className="space-y-2">
        <Label htmlFor="changelog-summary">Summary</Label>
        <Input
          id="changelog-summary"
          placeholder="One-line summary of changes (optional)"
          value={value.summary || ''}
          onChange={(e) => handleSummaryChange(e.target.value)}
          maxLength={500}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Brief overview of the changes in this version (max 500 characters)
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Change Sections</Label>
          {availableCategories.length > 0 && (
            <Select
              value=""
              onValueChange={(category) => handleAddSection(category as ChangelogCategory)}
              disabled={disabled}
            >
              <SelectTrigger className="w-[200px]" data-testid="add-section-trigger">
                <Plus className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Add Section" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {value.sections.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p>No changes documented yet.</p>
            <p className="text-sm">
              Use the &quot;Add Section&quot; button to add change categories.
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={value.sections.map((s) => s.category)}
            className="space-y-2"
          >
            {value.sections.map((section, sectionIndex) => (
              <AccordionItem
                key={section.category}
                value={section.category}
                className="rounded-lg border bg-card"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{CATEGORY_LABELS[section.category]}</span>
                    <span className="text-xs text-muted-foreground">
                      ({section.items.length} {section.items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {section.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="relative rounded-md border bg-background p-4 space-y-3"
                      >
                        {/* Remove item button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-6 w-6"
                          onClick={() => handleRemoveItem(sectionIndex, itemIndex)}
                          disabled={disabled}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>

                        {/* Description */}
                        <div className="space-y-1 pr-8">
                          <Label htmlFor={`item-${sectionIndex}-${itemIndex}-description`}>
                            Description
                          </Label>
                          <Textarea
                            id={`item-${sectionIndex}-${itemIndex}-description`}
                            placeholder="Describe the change..."
                            value={item.description}
                            onChange={(e) =>
                              handleItemChange(
                                sectionIndex,
                                itemIndex,
                                'description',
                                e.target.value
                              )
                            }
                            maxLength={2000}
                            disabled={disabled}
                            className="min-h-[80px]"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {/* Change Type */}
                          <div className="space-y-1">
                            <Label htmlFor={`item-${sectionIndex}-${itemIndex}-type`}>
                              Change Type
                            </Label>
                            <Select
                              value={item.changeType || 'none'}
                              onValueChange={(v) =>
                                handleItemChange(
                                  sectionIndex,
                                  itemIndex,
                                  'changeType',
                                  v === 'none' ? undefined : v
                                )
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger
                                id={`item-${sectionIndex}-${itemIndex}-type`}
                                data-testid={`item-${sectionIndex}-${itemIndex}-type`}
                              >
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {CHANGE_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {CHANGE_TYPE_LABELS[type]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Location */}
                          <div className="space-y-1">
                            <Label htmlFor={`item-${sectionIndex}-${itemIndex}-location`}>
                              Location
                            </Label>
                            <Input
                              id={`item-${sectionIndex}-${itemIndex}-location`}
                              placeholder="e.g., Section 3.2"
                              value={item.location || ''}
                              onChange={(e) =>
                                handleItemChange(
                                  sectionIndex,
                                  itemIndex,
                                  'location',
                                  e.target.value
                                )
                              }
                              maxLength={100}
                              disabled={disabled}
                            />
                          </div>

                          {/* Review Reference (conditional) */}
                          {showReviewFields && (
                            <div className="space-y-1">
                              <Label htmlFor={`item-${sectionIndex}-${itemIndex}-review`}>
                                Review Reference
                              </Label>
                              <Input
                                id={`item-${sectionIndex}-${itemIndex}-review`}
                                placeholder="e.g., Reviewer 1, Comment 3"
                                value={item.reviewReference || ''}
                                onChange={(e) =>
                                  handleItemChange(
                                    sectionIndex,
                                    itemIndex,
                                    'reviewReference',
                                    e.target.value
                                  )
                                }
                                maxLength={200}
                                disabled={disabled}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Add item button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddItem(sectionIndex)}
                      disabled={disabled || section.items.length >= 50}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>

                    {/* Remove section button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSection(sectionIndex)}
                      disabled={disabled}
                      className="w-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Section
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Reviewer Response (collapsible) */}
      <Collapsible open={reviewerResponseOpen} onOpenChange={setReviewerResponseOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex w-full items-center justify-between p-2 hover:bg-muted"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span>Response to Peer Review</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', reviewerResponseOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-2">
            <Textarea
              id="reviewer-response"
              placeholder="Provide a general response to peer review feedback..."
              value={value.reviewerResponse || ''}
              onChange={(e) => handleReviewerResponseChange(e.target.value)}
              maxLength={10000}
              disabled={disabled}
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Optional overall response to peer review feedback (max 10,000 characters)
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
