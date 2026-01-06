/**
 * Authentication mocks for testing.
 *
 * @remarks
 * Provides mock implementations of the auth context and hooks
 * for testing authenticated and unauthenticated components.
 *
 * @packageDocumentation
 */

import { vi, type MockedFunction } from 'vitest';
import type { ReactNode } from 'react';
import type { AuthState, ChiveUser, AuthSession, LoginOptions } from '@/lib/auth/types';
import { createMockAgent, type MockAgent } from './atproto';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for creating a mock auth state.
 */
export interface MockAuthOptions {
  /** Whether the user is authenticated */
  isAuthenticated?: boolean;
  /** Whether auth is loading */
  isLoading?: boolean;
  /** User data */
  user?: Partial<ChiveUser>;
  /** Session data */
  session?: Partial<AuthSession>;
  /** Error message */
  error?: string | null;
}

/**
 * Mock auth context value with Vitest mocks.
 */
export interface MockAuthContextValue extends AuthState {
  login: MockedFunction<(options: LoginOptions) => Promise<void>>;
  logout: MockedFunction<() => Promise<void>>;
  refresh: MockedFunction<() => Promise<void>>;
  getAccessToken: MockedFunction<() => Promise<string | null>>;
}

// =============================================================================
// MOCK FACTORIES
// =============================================================================

/**
 * Creates a mock ChiveUser.
 *
 * @param overrides - Optional property overrides
 * @returns Mock user object
 */
export function createMockUser(overrides: Partial<ChiveUser> = {}): ChiveUser {
  return {
    did: 'did:plc:testuser123' as ChiveUser['did'],
    handle: 'testuser.bsky.social',
    displayName: 'Test User',
    description: 'A test user for Chive',
    avatar: 'https://example.com/avatar.jpg',
    pdsEndpoint: 'https://bsky.social',
    ...overrides,
  };
}

/**
 * Creates a mock AuthSession.
 *
 * @param overrides - Optional property overrides
 * @returns Mock session object
 */
export function createMockSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: 'mock-access-token-jwt',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    scope: ['atproto'],
    ...overrides,
  };
}

/**
 * Creates a mock AuthState.
 *
 * @param options - Configuration options
 * @returns Mock auth state
 */
export function createMockAuthState(options: MockAuthOptions = {}): AuthState {
  const { isAuthenticated = true, isLoading = false, user, session, error = null } = options;

  if (isAuthenticated) {
    return {
      isAuthenticated: true,
      isLoading,
      user: createMockUser(user),
      session: createMockSession(session),
      error,
    };
  }

  return {
    isAuthenticated: false,
    isLoading,
    user: null,
    session: null,
    error,
  };
}

/**
 * Creates a mock AuthContextValue with mock functions.
 *
 * @param options - Configuration options
 * @returns Mock auth context value
 *
 * @example
 * ```typescript
 * const mockAuth = createMockAuthContext();
 *
 * // Configure login to fail
 * mockAuth.login.mockRejectedValueOnce(new Error('Login failed'));
 *
 * // Mock the useAuth hook
 * vi.mocked(useAuth).mockReturnValue(mockAuth);
 * ```
 */
export function createMockAuthContext(options: MockAuthOptions = {}): MockAuthContextValue {
  const state = createMockAuthState(options);

  return {
    ...state,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue(state.isAuthenticated ? 'mock-access-token' : null),
  };
}

/**
 * Creates an unauthenticated mock auth context.
 *
 * @returns Mock auth context with isAuthenticated: false
 */
export function createUnauthenticatedMockAuthContext(): MockAuthContextValue {
  return createMockAuthContext({ isAuthenticated: false });
}

/**
 * Creates a loading mock auth context.
 *
 * @returns Mock auth context with isLoading: true
 */
export function createLoadingMockAuthContext(): MockAuthContextValue {
  return createMockAuthContext({ isLoading: true, isAuthenticated: false });
}

/**
 * Creates an error mock auth context.
 *
 * @param error - Error message
 * @returns Mock auth context with error
 */
export function createErrorMockAuthContext(
  error: string = 'Authentication failed'
): MockAuthContextValue {
  return createMockAuthContext({
    isAuthenticated: false,
    error,
  });
}

// =============================================================================
// MOCK PROVIDERS
// =============================================================================

/**
 * Creates a mock AuthProvider component for testing.
 *
 * @param mockAuth - Mock auth context value
 * @returns Mock provider component
 *
 * @example
 * ```typescript
 * const mockAuth = createMockAuthContext();
 * const MockProvider = createMockAuthProvider(mockAuth);
 *
 * render(
 *   <MockProvider>
 *     <MyComponent />
 *   </MockProvider>
 * );
 * ```
 */
export function createMockAuthProvider(_mockAuth: MockAuthContextValue) {
  return function MockAuthProvider({ children }: { children: ReactNode }) {
    // Return children directly; the mock hooks will provide the context.
    return children;
  };
}

// =============================================================================
// VITEST MOCK HELPERS
// =============================================================================

/**
 * Creates the mock module for @/lib/auth/auth-context.
 *
 * @param mockAuth - Optional pre-configured mock auth context
 * @param mockAgent - Optional pre-configured mock agent
 * @returns Module mock factory for vi.mock
 *
 * @example
 * ```typescript
 * const mockAuth = createMockAuthContext();
 * vi.mock('@/lib/auth/auth-context', () => createAuthMock(mockAuth));
 * ```
 */
export function createAuthMock(mockAuth?: MockAuthContextValue, mockAgent?: MockAgent) {
  const auth = mockAuth ?? createMockAuthContext();
  const agent = mockAgent ?? createMockAgent();

  return {
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => auth,
    useIsAuthenticated: () => auth.isAuthenticated && !auth.isLoading,
    useCurrentUser: () => auth.user,
    useAgent: () => (auth.isAuthenticated ? agent : null),
    AuthContext: {
      Provider: ({ children }: { children: ReactNode }) => children,
      Consumer: ({ children }: { children: (value: MockAuthContextValue) => ReactNode }) =>
        children(auth),
    },
  };
}

/**
 * Creates mock return values for useAuth hook.
 *
 * @param options - Configuration options
 * @returns Object suitable for vi.mocked(useAuth).mockReturnValue
 */
export function mockUseAuth(options: MockAuthOptions = {}): MockAuthContextValue {
  return createMockAuthContext(options);
}

/**
 * Creates mock return value for useAgent hook.
 *
 * @param authenticated - Whether to return an authenticated agent
 * @returns Mock agent or null
 */
export function mockUseAgent(authenticated: boolean = true): MockAgent | null {
  return authenticated ? createMockAgent() : null;
}

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Simulates successful login.
 *
 * @param mockAuth - Mock auth context
 * @param user - User to log in as
 */
export function simulateLogin(mockAuth: MockAuthContextValue, user?: Partial<ChiveUser>): void {
  Object.assign(
    mockAuth,
    createMockAuthState({
      isAuthenticated: true,
      user,
    })
  );
}

/**
 * Simulates logout.
 *
 * @param mockAuth - Mock auth context
 */
export function simulateLogout(mockAuth: MockAuthContextValue): void {
  Object.assign(
    mockAuth,
    createMockAuthState({
      isAuthenticated: false,
    })
  );
}

/**
 * Simulates login failure.
 *
 * @param mockAuth - Mock auth context
 * @param error - Error message
 */
export function simulateLoginFailure(
  mockAuth: MockAuthContextValue,
  error: string = 'Login failed'
): void {
  mockAuth.login.mockRejectedValueOnce(new Error(error));
}

/**
 * Verifies login was called with expected handle.
 *
 * @param mockAuth - Mock auth context
 * @param handle - Expected handle
 */
export function expectLoginCalledWith(mockAuth: MockAuthContextValue, handle: string): void {
  expect(mockAuth.login).toHaveBeenCalledWith(expect.objectContaining({ handle }));
}

/**
 * Verifies logout was called.
 *
 * @param mockAuth - Mock auth context
 */
export function expectLogoutCalled(mockAuth: MockAuthContextValue): void {
  expect(mockAuth.logout).toHaveBeenCalled();
}
