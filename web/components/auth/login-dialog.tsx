'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { LoginForm } from './login-form';

/**
 * Props for the LoginDialog component.
 */
export interface LoginDialogProps {
  /**
   * Trigger element (defaults to "Sign In" button).
   */
  trigger?: React.ReactNode;

  /**
   * Controlled open state.
   */
  open?: boolean;

  /**
   * Callback when open state changes.
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Login dialog component.
 *
 * @remarks
 * Modal dialog for ATProto OAuth authentication.
 * Users can sign in with their Bluesky handle or PDS URL.
 *
 * @example
 * ```tsx
 * // With default trigger
 * <LoginDialog />
 *
 * // With custom trigger
 * <LoginDialog trigger={<Button variant="outline">Login</Button>} />
 *
 * // Controlled
 * <LoginDialog open={isOpen} onOpenChange={setIsOpen} />
 * ```
 */
export function LoginDialog({ trigger, open, onOpenChange }: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = () => {
    // Login redirects, so we just need to show loading
    setIsLoading(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button>Sign In</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Chive</DialogTitle>
          <DialogDescription>
            Use your Bluesky handle or AT Protocol identity to sign in. Your data stays in your
            Personal Data Server.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Redirecting to your PDS...</p>
            </div>
          </div>
        ) : (
          <LoginForm onSuccess={handleSuccess} />
        )}
      </DialogContent>
    </Dialog>
  );
}
