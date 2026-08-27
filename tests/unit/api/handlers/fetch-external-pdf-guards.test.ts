import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/**
 * The PDF proxy's guards are structural: it must not hand `fetch` the job of
 * following redirects, and it must not buffer a whole response before knowing
 * how big it is. Both are assertions about which calls appear in the handler,
 * and both regress by deletion rather than by producing a wrong value, which is
 * exactly the shape a source-level check catches and a behavioural one misses.
 */
describe('fetchExternalPdf guards', () => {
  const source = readFileSync(
    join(REPO_ROOT, 'src/api/handlers/xrpc/claiming/fetchExternalPdf.ts'),
    'utf8'
  );

  it('does not let fetch follow redirects on its own', () => {
    // An allowlisted host redirecting to an internal address is the SSRF this
    // closes; automatic following would re-open it silently.
    expect(source).toContain("redirect: 'manual'");
    expect(source).not.toMatch(/redirect:\s*'follow'/);
  });

  it('re-checks the allowlist after a redirect', () => {
    const redirectBlock = source.slice(
      source.indexOf('async function fetchAllowlistedPdf'),
      source.indexOf('async function readBounded')
    );
    expect(redirectBlock).toContain('isAllowedDomain(next)');
  });

  it('bounds the number of redirect hops', () => {
    expect(source).toContain('MAX_REDIRECTS');
  });

  it('never buffers the body without a cap', () => {
    // `arrayBuffer()` reads whatever arrives; the bounded reader is the whole
    // point of this guard.
    expect(source).not.toContain('await response.arrayBuffer()');
    expect(source).toContain('readBounded(response)');
  });

  it('checks the declared length and the actual stream', () => {
    const bounded = source.slice(source.indexOf('async function readBounded'));
    expect(bounded).toContain('content-length');
    expect(bounded).toContain('MAX_PDF_BYTES');
    expect(bounded).toContain('reader.cancel()');
  });

  it('requires https so a redirect cannot downgrade the hop', () => {
    expect(source).toContain("parsed.protocol !== 'https:'");
  });

  it('does not reflect the rejected URL back to the caller', () => {
    // Echoing it turns the endpoint into an oracle for the allowlist contents.
    expect(source).not.toMatch(/not from allowed domain: \$\{/);
  });
});
