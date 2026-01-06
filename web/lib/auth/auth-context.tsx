'use client';

/**
 * Authentication context for Chive.
 *
 * @remarks
 * Provides authentication state and actions throughout the app.
 * Uses the official @atproto/oauth-client-browser library.
 *
 * Authentication flow (ATProto standard):
 * 1. User initiates login with their handle
 * 2. OAuth flow via BrowserOAuthClient handles PKCE, DPoP, PAR
 * 3. After OAuth, user has an authenticated session with their PDS
 * 4. For Chive API calls, service auth JWTs are requested from PDS
 * 5. JWTs are signed with user's ATProto signing key and verified by Chive
 *
 * @see {@link https://github.com/bluesky-social/atproto/tree/main/packages/oauth/oauth-client-browser | ATProto OAuth Client}
 * @see {@link https://docs.bsky.app/docs/advanced-guides/service-auth | ATProto Service Auth}
 */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { Agent } from '@atproto/api';
import type { AuthState, AuthContextValue, ChiveUser, LoginOptions } from './types';
import {
  startLogin,
  logout as oauthLogout,
  initializeOAuth,
  restoreSession,
  getCurrentAgent,
  setE2EMockAgent,
} from './oauth-client';
import { clearServiceAuthTokens } from './service-auth';

/**
 * Initial auth state.
 */
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  session: null,
  error: null,
};

/**
 * Auth context.
 */
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider props.
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component.
 *
 * @remarks
 * Wraps the app to provide authentication state and actions.
 * Should be placed near the root of the component tree, above QueryProvider.
 *
 * @example
 * ```tsx
 * <AuthProvider>
 *   <QueryProvider>
 *     <App />
 *   </QueryProvider>
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState);

  /**
   * Initialize auth state from OAuth client.
   *
   * @remarks
   * With ATProto service auth, we don't need to create a separate Chive session.
   * The OAuth session gives us an authenticated Agent that can request service
   * auth JWTs from the user's PDS on-demand for Chive API calls.
   *
   * In E2E test mode (NEXT_PUBLIC_E2E_TEST=true), OAuth initialization is skipped
   * entirely to avoid network dependencies and ensure fast, reliable tests.
   * This follows industry best practices for OAuth testing.
   *
   * @see {@link https://authjs.dev/guides/testing | Auth.js Testing Guide}
   * @see {@link https://playwright.dev/docs/auth | Playwright Authentication}
   */
  useEffect(() => {
    const initAuth = async () => {
      // E2E Test Mode: Check for mock session data set by Playwright auth.setup.ts
      // This enables testing without real OAuth by using localStorage-based mock sessions
      // See: https://authjs.dev/guides/testing
      const mockSessionData = localStorage.getItem('chive_session_metadata');
      const skipOAuth = localStorage.getItem('chive_e2e_skip_oauth');

      if (mockSessionData) {
        // Authenticated E2E test: use mock session.
        const metadata = JSON.parse(mockSessionData);

        // Set up mock agent for E2E testing
        // This creates an Agent that implements uploadBlob, createRecord, etc.
        // following ATProto patterns without requiring a real PDS connection
        setE2EMockAgent(metadata.did, metadata.handle);

        setState({
          isAuthenticated: true,
          isLoading: false,
          user: {
            did: metadata.did,
            handle: metadata.handle,
            displayName: metadata.displayName,
            avatar: metadata.avatar,
            pdsEndpoint: metadata.pdsEndpoint,
          },
          session: {
            accessToken: 'mock-e2e-token',
            refreshToken: '',
            expiresAt: Date.now() + 3600000,
            scope: ['atproto'],
          },
          error: null,
        });
        return;
      }

      if (skipOAuth) {
        // Unauthenticated E2E test: skip OAuth, return immediately.
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          session: null,
          error: null,
        });
        return;
      }

      try {
        // First, check if this is an OAuth callback
        const callbackResult = await initializeOAuth();

        if (callbackResult) {
          // Successfully handled OAuth callback
          // Service auth JWTs will be requested on-demand by the API client
          setState({
            isAuthenticated: true,
            isLoading: false,
            user: callbackResult.user,
            session: {
              // No custom access token; service auth JWTs are requested per-call.
              accessToken: '',
              refreshToken: '',
              expiresAt: 0,
              scope: ['atproto'],
            },
            error: null,
          });
          return;
        }

        // Try to restore an existing session
        const restoredSession = await restoreSession();

        if (restoredSession) {
          // OAuth session restored; service auth JWTs will be requested on-demand.
          setState({
            isAuthenticated: true,
            isLoading: false,
            user: restoredSession.user,
            session: {
              // No custom access token; service auth JWTs are requested per-call.
              accessToken: '',
              refreshToken: '',
              expiresAt: 0,
              scope: ['atproto'],
            },
            error: null,
          });
          return;
        }

        // No session found
        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        }));
      }
    };

    initAuth();
  }, []);

  /**
   * Login action.
   */
  const login = useCallback(async (options: LoginOptions) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Start OAuth flow; redirects to authorization server.
      const authUrl = await startLogin(options);

      // Redirect to authorization URL
      window.location.href = authUrl;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
      throw error;
    }
  }, []);

  /**
   * Logout action.
   */
  const logout = useCallback(async () => {
    try {
      // Clear cached service auth tokens
      clearServiceAuthTokens();
      // Sign out from OAuth session
      await oauthLogout();
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
        error: null,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear state and tokens even if logout fails
      clearServiceAuthTokens();
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        session: null,
        error: null,
      });
    }
  }, []);

  /**
   * Refresh token action.
   *
   * @remarks
   * With BrowserOAuthClient, token refresh is handled automatically.
   */
  const refresh = useCallback(async () => {
    // Token refresh is handled automatically by the OAuth client
    // This is a no-op for compatibility
  }, []);

  /**
   * Get access token (refresh if needed).
   *
   * @remarks
   * With BrowserOAuthClient, you should use the Agent directly instead
   * of extracting access tokens. The agent handles auth automatically.
   */
  const getAccessTokenAction = useCallback(async (): Promise<string | null> => {
    // Token management is handled by the OAuth session
    // Use getCurrentAgent() to make authenticated requests
    return null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refresh,
      getAccessToken: getAccessTokenAction,
    }),
    [state, login, logout, refresh, getAccessTokenAction]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 *
 * @remarks
 * Must be used within an AuthProvider.
 *
 * @returns Auth context value
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAuthenticated, user, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <button onClick={() => login({ handle: '' })}>Login</button>;
 *   }
 *
 *   return <div>Welcome, {user?.displayName}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Hook to check if user is authenticated.
 *
 * @returns True if authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}

/**
 * Hook to get current user.
 *
 * @returns Current user or null
 */
export function useCurrentUser(): ChiveUser | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to get the ATProto Agent for making authenticated API calls.
 *
 * @remarks
 * The Agent handles authentication automatically, including token refresh.
 *
 * @returns Agent instance or null if not authenticated
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const agent = useAgent();
 *
 *   const fetchProfile = async () => {
 *     if (!agent) return;
 *     const profile = await agent.getProfile({ actor: agent.accountDid });
 *   };
 * }
 * ```
 */
export function useAgent(): Agent | null {
  return getCurrentAgent();
}

/**
 * Export context for use in callback page.
 */
export { AuthContext };
