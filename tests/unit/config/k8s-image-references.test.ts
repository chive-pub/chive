/**
 * Unit tests for the container images the Kubernetes manifests reference.
 *
 * @remarks
 * The manifests referred to the bare names `chive` and `chive-frontend`, which
 * resolve against Docker Hub, while CI publishes to `ghcr.io/chive-pub/chive`.
 * The overlays set only `newTag` and never `newName`, so the registry was never
 * corrected. The base tag was `latest`, which CI does not produce — it tags
 * `type=sha` and `type=ref,event=branch`. The result was manifests that could
 * not pull an image in any environment.
 *
 * Nothing exercises these manifests: Chive deploys with docker-compose over SSH,
 * so no pipeline would have caught this. That is precisely why it is worth a
 * test — the alternative is discovering it during a migration to Kubernetes,
 * under time pressure.
 *
 * These assert the manifests are internally consistent with what CI builds.
 * They cannot prove an image exists in the registry; only a pull can do that.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

const read = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8');

const OVERLAYS = [
  ['staging', 'staging'],
  ['development', 'develop'],
  ['production', 'main'],
] as const;

describe('image references name the registry CI publishes to', () => {
  it('the base sets newName, not just newTag', () => {
    const base = read('k8s/base/kustomization.yaml');
    expect(base).toMatch(/newName: ghcr\.io\/chive-pub\/chive$/m);
  });

  it.each(OVERLAYS)('the %s overlay sets newName', (env) => {
    expect(read(`k8s/overlays/${env}/kustomization.yaml`)).toMatch(/newName: ghcr\.io\/chive-pub/);
  });

  // `latest` is the specific tag CI never produces.
  it('no manifest pins the tag CI does not build', () => {
    const base = read('k8s/base/kustomization.yaml');
    const tags = [...base.matchAll(/^\s+newTag: (\S+)$/gm)].map((m) => m[1]);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags).not.toContain('latest');
  });

  // CI tags by branch, so the tag has to be a branch it builds from.
  it.each(OVERLAYS)('the %s overlay uses the branch tag CI builds (%s)', (env, tag) => {
    expect(read(`k8s/overlays/${env}/kustomization.yaml`)).toMatch(
      new RegExp(`newTag: ${tag}$`, 'm')
    );
  });
});

describe('the unpublished frontend image is recorded, not papered over', () => {
  // CI publishes no frontend image; production builds it on the server and
  // never pushes it. Correcting the name does not make it pullable.
  it('the base says so', () => {
    expect(read('k8s/base/kustomization.yaml')).toMatch(/chive-frontend is NOT published by CI/);
  });

  it('the README says these manifests are not the deployment path', () => {
    const readme = read('k8s/README.md');
    expect(readme).toMatch(/not the deployment path in use/i);
    expect(readme).toMatch(/docker-compose/);
  });
});
