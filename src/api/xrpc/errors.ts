/**
 * XRPC error classes re-exported from @atproto/xrpc-server.
 *
 * @remarks
 * These error classes are standalone TypeScript and can be imported directly
 * from @atproto/xrpc-server. They provide ATProto-compliant error handling
 * with proper error codes and HTTP status mapping.
 *
 * @packageDocumentation
 * @public
 */

export {
  XRPCError,
  InvalidRequestError,
  AuthRequiredError,
  ForbiddenError,
  InternalServerError,
  UpstreamFailureError,
  UpstreamTimeoutError,
  NotEnoughResourcesError,
  MethodNotImplementedError,
  RateLimitExceededError,
} from '@atproto/xrpc-server';

/**
 * NotFoundError for XRPC endpoints.
 *
 * @remarks
 * The @atproto/xrpc-server package doesn't export a NotFoundError,
 * so we create a compatible one here.
 */
import { XRPCError } from '@atproto/xrpc-server';

export class NotFoundError extends XRPCError {
  constructor(message = 'Not found') {
    // XRPCError constructor: (type, errorMessage, customErrorName)
    // - type: 404 (maps to ResponseType.XRPCNotSupported)
    // - errorMessage: the human-readable message
    // - customErrorName: 'NotFound' to override the default 'XRPCNotSupported'
    super(404, message, 'NotFound');
  }
}
