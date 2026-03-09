'use client';

import { VolumeX, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsAuthorMuted, useMuteAuthor, useUnmuteAuthor } from '@/lib/hooks/use-muted-authors';
import { useCurrentUser } from '@/lib/auth';

interface MuteButtonProps {
  did: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
}

/**
 * Toggle button for muting/unmuting an author.
 *
 * @remarks
 * Only shown to authenticated users. Hidden when viewing own profile.
 */
export function MuteButton({ did, variant = 'outline', size = 'sm' }: MuteButtonProps) {
  const user = useCurrentUser();
  const isMuted = useIsAuthorMuted(did);
  const { mutate: mute, isPending: isMuting } = useMuteAuthor();
  const { mutate: unmute, isPending: isUnmuting } = useUnmuteAuthor();

  // Don't show if not authenticated or viewing own profile
  if (!user || user.did === did) return null;

  const isPending = isMuting || isUnmuting;

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMuted) {
          unmute(did);
        } else {
          mute(did);
        }
      }}
    >
      {isMuted ? (
        <>
          <Volume2 className="h-4 w-4 mr-1" />
          Unmute
        </>
      ) : (
        <>
          <VolumeX className="h-4 w-4 mr-1" />
          Mute
        </>
      )}
    </Button>
  );
}
