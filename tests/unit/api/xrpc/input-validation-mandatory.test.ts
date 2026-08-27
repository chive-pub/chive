import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const source = readFileSync(join(REPO_ROOT, 'src/api/xrpc/hono-adapter.ts'), 'utf8');

/**
 * Input validation used to sit inside the `content-type: application/json`
 * branch, together with the parse. Sending any other content type skipped the
 * whole block: `input` stayed `undefined` and `validateXrpcInput` was never
 * reached — schema validation was opt-in, and the caller was the one opting.
 *
 * This is a structural property of where the call sits, so it is checked
 * structurally; a behavioural test would pass just as well with the call back
 * inside the branch as long as the happy path still ran.
 */
describe('XRPC input validation cannot be opted out of', () => {
  const start = source.indexOf('// Parse input (for procedures or queries with body)');
  const procedureBlock = source.slice(start, source.indexOf('if (debug) {', start));

  it('validates outside the JSON content-type branch', () => {
    const jsonBranch = procedureBlock.slice(
      procedureBlock.indexOf("if (contentType.includes('application/json'))"),
      procedureBlock.indexOf('} else if (expectsJson)')
    );
    expect(jsonBranch).not.toContain('validateXrpcInput');
    expect(procedureBlock).toContain('validateXrpcInput(lexicons, nsid, input)');
  });

  it('rejects a non-JSON body on a method whose lexicon declares one', () => {
    expect(procedureBlock).toContain('expectsJson');
    expect(procedureBlock).toContain('InvalidRequestError');
  });

  it('reads the declared encoding from the lexicon rather than assuming', () => {
    expect(procedureBlock).toContain('declaredEncoding');
    expect(procedureBlock).toContain('def.input?.encoding');
  });

  it('still validates when no body arrived at all', () => {
    // `validateXrpcInput(..., undefined)` is what makes a lexicon that requires
    // input reject a request that omitted it, instead of the handler receiving
    // undefined and possibly not checking.
    const afterBranches = procedureBlock.slice(procedureBlock.indexOf('} else if (expectsJson)'));
    expect(afterBranches).toContain('validateXrpcInput');
  });
});
