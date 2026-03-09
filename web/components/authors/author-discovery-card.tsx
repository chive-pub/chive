'use client';

import Link from 'next/link';
import { User } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MuteButton } from './mute-button';
import type { DiscoveredAuthor } from '@/lib/hooks/use-personalized-authors';

interface AuthorDiscoveryCardProps {
  author: DiscoveredAuthor;
}

/**
 * Card for displaying an author in the discovery grid on the /authors page.
 */
export function AuthorDiscoveryCard({ author }: AuthorDiscoveryCardProps) {
  const initials = author.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/authors/${encodeURIComponent(author.did)}`} className="shrink-0">
            <Avatar className="h-12 w-12">
              {author.avatarUrl ? <AvatarImage src={author.avatarUrl} alt={author.name} /> : null}
              <AvatarFallback>{initials || <User className="h-5 w-5" />}</AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <Link
              href={`/authors/${encodeURIComponent(author.did)}`}
              className="font-medium hover:text-primary transition-colors line-clamp-1"
            >
              {author.name}
            </Link>
            {author.handle && (
              <p className="text-sm text-muted-foreground truncate">@{author.handle}</p>
            )}
            {author.fields && author.fields.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {author.fields.slice(0, 3).map((field) => (
                  <Badge key={field.uri} variant="outline" className="text-xs">
                    {field.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0">
            <MuteButton did={author.did} variant="ghost" size="sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton placeholder for AuthorDiscoveryCard.
 */
export function AuthorDiscoveryCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted animate-pulse rounded" />
            <div className="flex gap-1 mt-1">
              <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
              <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
