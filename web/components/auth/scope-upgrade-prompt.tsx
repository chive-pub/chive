'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import type { AuthIntent } from '@/lib/auth/scopes';

interface ScopeUpgradePromptProps {
  requiredScope: AuthIntent;
  action: string;
}

/**
 * Prompt displayed when a user tries an action their current scopes don't cover.
 *
 * @remarks
 * Offers to re-authenticate with broader scopes. The BrowserOAuthClient
 * handles re-authorization gracefully, preserving the existing session
 * if the user cancels.
 */
export function ScopeUpgradePrompt({ requiredScope, action }: ScopeUpgradePromptProps) {
  const { login } = useAuth();

  return (
    <Alert>
      <ShieldAlert className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Your current session does not have permission to {action}.</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-4"
          onClick={() => login({ intent: requiredScope })}
        >
          Upgrade permissions
        </Button>
      </AlertDescription>
    </Alert>
  );
}
