'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsAuthenticated } from '@/lib/auth';

const STORAGE_KEY = 'chive_onboarding_prompt_dismissed';

/**
 * Banner prompting new authenticated users to link academic accounts.
 *
 * @remarks
 * Displays below the open alpha banner for authenticated users who have
 * not dismissed it. Dismissed state is persisted in localStorage.
 */
export function OnboardingPromptBanner() {
  const isAuthenticated = useIsAuthenticated();
  const [dismissed, setDismissed] = useState(true); // Default true to prevent flash

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== 'true') {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (dismissed || !isAuthenticated) {
    return null;
  }

  return (
    <div className="border-b border-indigo-500/20 bg-indigo-50 dark:bg-indigo-950/30">
      <div className="container flex items-center gap-3 px-4 py-2.5 text-sm">
        <Link2 className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <p className="flex-1 text-indigo-800 dark:text-indigo-200">
          Link your ORCID or academic accounts to get personalized recommendations and claim your
          publications.
        </p>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
          <Link href="/onboarding/link-accounts">Link Accounts</Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
