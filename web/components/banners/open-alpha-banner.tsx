'use client';

import { useState, useEffect } from 'react';
import { X, Bug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIsAuthenticated } from '@/lib/auth';

const STORAGE_KEY = 'chive_open_alpha_banner_dismissed';

/**
 * Dismissable banner shown to authenticated users on first visit.
 *
 * @remarks
 * Informs users that Chive is in open alpha and encourages bug reports.
 * Dismissed state is persisted in localStorage.
 */
export function OpenAlphaBanner() {
  const isAuthenticated = useIsAuthenticated();
  const [dismissed, setDismissed] = useState(true); // Default true to prevent flash

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== 'true') {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  if (dismissed || !isAuthenticated) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/20 bg-amber-50 dark:bg-amber-950/30">
      <div className="container flex items-center gap-3 px-4 py-2.5 text-sm">
        <Bug className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="flex-1 text-amber-800 dark:text-amber-200">
          Chive is in open alpha. You may encounter bugs or incomplete features. We appreciate and
          encourage{' '}
          <a
            href="https://github.com/chive-pub/chive/issues/new?labels=bug"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline hover:no-underline"
          >
            bug reports
          </a>
          !
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
