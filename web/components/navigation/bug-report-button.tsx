'use client';

import { Bug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/lib/auth';

const GITHUB_ISSUES_URL = 'https://github.com/chive-pub/chive/issues/new';

/**
 * Builds a GitHub issue URL with pre-filled environment info.
 */
function buildBugReportUrl(userHandle?: string): string {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const user = userHandle ?? 'Not signed in';

  const body = [
    '## Description',
    '',
    '<!-- Describe the bug -->',
    '',
    '## Steps to Reproduce',
    '',
    '1. ',
    '',
    '## Expected Behavior',
    '',
    '<!-- What did you expect to happen? -->',
    '',
    '## Environment',
    '',
    `- **URL**: ${url}`,
    `- **User**: ${user}`,
    `- **Browser**: ${ua}`,
  ].join('\n');

  const params = new URLSearchParams({
    title: '',
    body,
    labels: 'bug',
  });

  return `${GITHUB_ISSUES_URL}?${params.toString()}`;
}

/**
 * Bug report button for the site header.
 *
 * @remarks
 * Opens a new GitHub issue pre-filled with environment details.
 */
export function BugReportButton() {
  const user = useCurrentUser();

  const handleClick = () => {
    const url = buildBugReportUrl(user?.handle);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleClick}>
            <Bug className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Report a bug</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Report a bug</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
