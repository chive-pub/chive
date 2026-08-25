/**
 * Unit tests for telemetry startup wiring.
 *
 * @remarks
 * `initTelemetry` was never called from either entry point. The OpenTelemetry
 * SDK therefore never started, every `withSpan` in the codebase executed its
 * callback without recording anything, and no OTLP export ever happened — the
 * tracing existed as decoration. Nothing failed, which is why it survived.
 *
 * Both processes need their own call: the API and the firehose indexer run
 * separately, and instrumenting one leaves the other dark.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const source = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const ENTRY_POINTS = [
  ['the API', 'src/index.ts', 'chive-appview'],
  ['the indexer', 'src/indexer.ts', 'chive-indexer'],
] as const;

describe('telemetry startup', () => {
  it.each(ENTRY_POINTS)('%s imports initTelemetry', (_label, path) => {
    expect(source(path)).toMatch(/import \{ initTelemetry \} from/);
  });

  it.each(ENTRY_POINTS)('%s calls it with its own service name', (_label, path, serviceName) => {
    expect(source(path)).toMatch(
      new RegExp(`initTelemetry\\(\\{[^}]*serviceName: '${serviceName}'`)
    );
  });

  // Without a configured endpoint outside production the exporter would retry a
  // collector that is not there, so local runs skip initialization instead.
  it.each(ENTRY_POINTS)('%s only initializes when there is somewhere to export', (_label, path) => {
    const contents = source(path);
    expect(contents).toMatch(/OTEL_EXPORTER_OTLP_ENDPOINT \|\| config\.nodeEnv === 'production'/);
  });

  it.each(ENTRY_POINTS)('%s honours the standard disable flag', (_label, path) => {
    expect(source(path)).toMatch(/OTEL_SDK_DISABLED === 'true'/);
  });
});
