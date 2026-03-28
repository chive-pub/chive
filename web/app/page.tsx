'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth, useIsAuthenticated } from '@/lib/auth';
import { HandleInput } from '@/components/auth/handle-input';
import { Button } from '@/components/ui/button';

/**
 * Public landing page for Chive.
 *
 * @remarks
 * Displays hero content with an inline ATProto login form.
 * Authenticated users are redirected to the dashboard.
 */
export default function LandingPage() {
  const router = useRouter();
  const { login } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const [handle, setHandle] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = useCallback(async () => {
    if (!handle.trim()) {
      setError('Please enter your handle');
      return;
    }

    setError(null);
    setIsLoggingIn(true);

    try {
      await login({ handle });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsLoggingIn(false);
    }
  }, [handle, login]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && handle.trim()) {
        handleLogin();
      }
    },
    [handle, handleLogin]
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="max-w-[600px] text-center">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chive-logo.svg" alt="Chive" className="mx-auto mb-8 h-[100px] w-[100px]" />

        {/* Title */}
        <h1 className="mb-2 text-5xl font-bold tracking-tight">Chive</h1>
        <p className="mb-6 text-2xl text-muted-foreground">Decentralized eprints on ATProto</p>

        {/* Description */}
        <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
          Share your research with full data sovereignty and community governance.
        </p>

        {/* Open Alpha Notice */}
        <div className="mx-auto mb-6 max-w-sm overflow-hidden rounded-xl border border-[#157200]/20 bg-gradient-to-br from-[#157200]/5 to-[#157200]/10 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#157200]/10 bg-[#157200]/5 px-4 py-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#157200] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#157200]">
              Open Alpha
            </span>
          </div>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Chive is in open alpha. You may encounter bugs or incomplete features.
          </p>
        </div>

        {/* Handle Input */}
        <div className="mx-auto mb-6 max-w-sm">
          <div className="mb-3" onKeyDown={handleKeyDown}>
            <HandleInput
              value={handle}
              onChange={setHandle}
              onSelect={(actor) => setHandle(actor.handle)}
              placeholder="yourhandle.example.com"
              disabled={isLoggingIn}
              className="w-full"
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={isLoggingIn || !handle.trim()}
            className="w-full bg-[#157200] hover:bg-[#125f00]"
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in with ATProto'
            )}
          </Button>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://docs.chive.pub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            Read the Docs
          </a>
          <a
            href="https://github.com/chive-pub/chive"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            GitHub
          </a>
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-base font-medium transition-colors hover:bg-muted"
          >
            ATProto
          </a>
        </div>
      </div>
    </main>
  );
}
