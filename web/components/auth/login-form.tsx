'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HandleInput } from './handle-input';
import { useAuth } from '@/lib/auth';

/**
 * Login form validation schema.
 */
const loginFormSchema = z.object({
  handle: z
    .string()
    .min(1, 'Handle is required')
    .refine(
      (val) => {
        // Allow handles like "alice.bsky.social" or "alice.example.com"
        // Also allow DIDs like "did:plc:abc123"
        return val.includes('.') || val.startsWith('did:');
      },
      { message: 'Enter a valid handle (e.g., alice.bsky.social) or DID' }
    ),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

/**
 * Props for the LoginForm component.
 */
export interface LoginFormProps {
  /**
   * Callback when login is initiated successfully.
   */
  onSuccess?: () => void;

  /**
   * Callback when login fails.
   */
  onError?: (error: Error) => void;
}

/**
 * Login form component.
 *
 * @remarks
 * Form for entering ATProto handle to initiate OAuth flow.
 * Validates handle format and initiates PKCE flow with user's PDS.
 */
export function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      handle: '',
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ handle: values.handle });
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="handle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Handle or DID</FormLabel>
              <FormControl>
                <HandleInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="alice.bsky.social"
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>Your Bluesky handle or AT Protocol identifier</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            'Continue with AT Protocol'
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By signing in, you authorize Chive to read your profile. Your data remains in your
          Personal Data Server.
        </p>
      </form>
    </Form>
  );
}
