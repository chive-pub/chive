'use client';

import { ExternalLink, Star, GitFork, Eye, EyeOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GitLabIntegration } from '@/lib/hooks/use-integrations';

export interface GitLabProjectCardProps {
  project: GitLabIntegration;
  className?: string;
}

/**
 * Displays GitLab project information as a card.
 *
 * @remarks
 * Shows project metadata including stars, forks, visibility, and topics.
 * Links to the GitLab project.
 */
export function GitLabProjectCard({ project, className }: GitLabProjectCardProps) {
  const isPublic = project.visibility === 'public';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="h-5 w-5 shrink-0" aria-hidden="true">
              <path fill="#E24329" d="M16 31.2L21.2 16H10.8L16 31.2z" />
              <path fill="#FC6D26" d="M16 31.2L10.8 16H2L16 31.2z" />
              <path fill="#FCA326" d="M2 16L.1 21.8c-.2.5 0 1.1.5 1.4L16 31.2L2 16z" />
              <path fill="#E24329" d="M2 16h8.8L7.5 5.4c-.1-.4-.7-.4-.9 0L2 16z" />
              <path fill="#FC6D26" d="M16 31.2L21.2 16H30L16 31.2z" />
              <path fill="#FCA326" d="M30 16l1.9 5.8c.2.5 0 1.1-.5 1.4L16 31.2L30 16z" />
              <path fill="#E24329" d="M30 16h-8.8l3.3-10.6c.1-.4.7-.4.9 0L30 16z" />
            </svg>
            <CardTitle className="text-base">
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                {project.pathWithNamespace}
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </a>
            </CardTitle>
          </div>
          <Badge variant={isPublic ? 'outline' : 'secondary'} className="shrink-0">
            {isPublic ? <Eye className="mr-1 h-3 w-3" /> : <EyeOff className="mr-1 h-3 w-3" />}
            {project.visibility}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4" />
            <span>{project.stars.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitFork className="h-4 w-4" />
            <span>{project.forks.toLocaleString()}</span>
          </div>
        </div>

        {project.topics && project.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.topics.slice(0, 5).map((topic) => (
              <Badge key={topic} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {project.topics.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{project.topics.length - 5}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
