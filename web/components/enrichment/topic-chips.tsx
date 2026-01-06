'use client';

import { ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichmentTopic } from '@/lib/api/schema';

export interface TopicChipsProps {
  topics: EnrichmentTopic[];
  /** Maximum number of topics to display */
  limit?: number;
  className?: string;
}

/**
 * Displays OpenAlex topics with hierarchical structure.
 *
 * @remarks
 * Topics have a hierarchy: Domain > Field > Subfield > Topic.
 * Shows the topic name with a tooltip displaying the full hierarchy.
 *
 * @example
 * ```tsx
 * <TopicChips topics={enrichment.topics} limit={5} />
 * ```
 */
export function TopicChips({ topics, limit = 5, className }: TopicChipsProps) {
  const displayedTopics = topics.slice(0, limit);
  const remainingCount = topics.length - limit;

  if (topics.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      <TooltipProvider>
        {displayedTopics.map((topic) => (
          <Tooltip key={topic.id}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs cursor-default hover:bg-muted/50 transition-colors"
                data-testid="topic-badge"
              >
                {topic.displayName}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <TopicHierarchy topic={topic} />
            </TooltipContent>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{remainingCount} more
          </Badge>
        )}
      </TooltipProvider>
    </div>
  );
}

/**
 * Displays the hierarchical path of a topic.
 */
function TopicHierarchy({ topic }: { topic: EnrichmentTopic }) {
  const parts: string[] = [];

  if (topic.domain) parts.push(topic.domain);
  if (topic.field) parts.push(topic.field);
  if (topic.subfield) parts.push(topic.subfield);
  if (topic.displayName && topic.displayName !== topic.subfield) {
    parts.push(topic.displayName);
  }

  if (parts.length <= 1) {
    return <span className="text-xs">{topic.displayName}</span>;
  }

  return (
    <div className="flex items-center gap-1 text-xs flex-wrap">
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <span className={index === parts.length - 1 ? 'font-medium' : 'text-muted-foreground'}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}
