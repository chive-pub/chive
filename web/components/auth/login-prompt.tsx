'use client';

import { useState } from 'react';
import { LogIn } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

import { LoginDialog } from './login-dialog';

/**
 * Props for the LoginPrompt component.
 */
export interface LoginPromptProps {
  /**
   * Action label to show in the prompt.
   * @example "endorse this preprint"
   */
  action: string;

  /**
   * Children to render when authenticated (optional).
   * If not provided, renders nothing when authenticated.
   */
  children?: React.ReactNode;

  /**
   * Custom button variant.
   */
  variant?: ButtonProps['variant'];

  /**
   * Custom button size.
   */
  size?: ButtonProps['size'];

  /**
   * Additional class names.
   */
  className?: string;
}

/**
 * Login prompt component.
 *
 * @remarks
 * Shows a login prompt for unauthenticated users trying to perform
 * actions that require authentication. Shows children when authenticated.
 *
 * @example
 * ```tsx
 * <LoginPrompt action="write a review">
 *   <ReviewForm />
 * </LoginPrompt>
 * ```
 */
export function LoginPrompt({
  action,
  children,
  variant = 'outline',
  size = 'sm',
  className,
}: LoginPromptProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Loading state: show nothing.
  if (isLoading) {
    return null;
  }

  // Authenticated: render children.
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Not authenticated: show login prompt.
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsDialogOpen(true)}
      >
        <LogIn className="mr-2 h-4 w-4" />
        Sign in to {action}
      </Button>
      <LoginDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}

/**
 * Inline login prompt for text contexts.
 *
 * @example
 * ```tsx
 * <p>
 *   <InlineLoginPrompt action="endorse" /> this preprint
 * </p>
 * ```
 */
export function InlineLoginPrompt({ action }: { action: string }) {
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="text-primary underline-offset-4 hover:underline"
        onClick={() => setIsDialogOpen(true)}
      >
        Sign in to {action}
      </button>
      <LoginDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
}
