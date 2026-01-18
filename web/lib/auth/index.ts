/**
 * Authentication module exports.
 *
 * @remarks
 * Provides ATProto OAuth authentication for Chive using the official
 * @atproto/oauth-client-browser library.
 */

// Types
export type {
  DID,
  Handle,
  ChiveUser,
  AuthSession,
  AuthState,
  AuthActions,
  AuthContextValue,
  LoginOptions,
  OAuthCallbackParams,
  TokenResponse,
} from './types';

// Context and hooks
export {
  AuthProvider,
  useAuth,
  useIsAuthenticated,
  useCurrentUser,
  useAgent,
  AuthContext,
} from './auth-context';

// OAuth client
export {
  startLogin,
  logout,
  resolveHandle,
  initializeOAuth,
  restoreSession,
  getCurrentAgent,
  getCurrentSession,
  getOAuthClient,
} from './oauth-client';

// Paper session management (for paper PDS submissions)
export {
  setPaperSession,
  getPaperSession,
  getActivePaperSession,
  hasPaperSession,
  clearPaperSession,
  clearAllPaperSessions,
  isPaperSessionValid,
  getPaperAgent,
  getAllPaperSessions,
  type PaperSession,
} from './paper-session';

// Paper OAuth popup flow
export {
  authenticatePaperInPopup,
  cancelPaperAuthentication,
  isPaperAuthInProgress,
  postPaperSessionToOpener,
  postPaperErrorToOpener,
  type PaperOAuthMessage,
} from './paper-oauth-popup';
