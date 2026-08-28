#!/usr/bin/env bash
# Validate that the Kubernetes manifests render and address services that exist.
#
# Two failures used to be invisible here because nothing ever built these files:
#
#   1. Every overlay failed `kubectl kustomize` outright — a configMapGenerator
#      with `behavior: merge` named a ConfigMap present in no base, and the
#      development overlay used deprecated multi-document strategic-merge
#      deletes. None of the three could be applied to a cluster.
#
#   2. The addresses pods read named a namespace and a set of Service names that
#      the overlays did not produce, so even a rendering overlay pointed every
#      pod at something unreachable.
#
# This script fails on either. Run it locally the same way CI does:
#
#   ./scripts/validate-k8s-manifests.sh
#
# Requires kubectl (its embedded kustomize is enough).

set -euo pipefail

cd "$(dirname "$0")/.."

TARGETS=(k8s/base k8s/overlays/development k8s/overlays/staging k8s/overlays/production)
failed=0

for target in "${TARGETS[@]}"; do
  printf '%-30s ' "$target"

  if ! rendered=$(kubectl kustomize "$target" 2>&1); then
    echo "FAIL (does not render)"
    echo "$rendered" | grep -E '^error' | head -3 | sed 's/^/    /'
    failed=1
    continue
  fi

  # Service names this overlay actually creates.
  services=$(echo "$rendered" | awk '
    /^kind: Service$/ { in_svc = 1; next }
    /^---/ { in_svc = 0 }
    in_svc && /^  name: / { print $2; in_svc = 0 }
  ' | sort -u)

  # Hosts the ConfigMaps point pods at, ignoring anything outside the cluster.
  hosts=$(echo "$rendered" \
    | grep -oE '(^|["/@])[a-z0-9-]+\.[a-z0-9-]+\.svc\.cluster\.local|"[a-z0-9-]+"$' \
    | tr -d '"' \
    | sed 's#^[/@]##' \
    | sort -u || true)

  missing=""
  while IFS= read -r host; do
    [ -z "$host" ] && continue
    case "$host" in
      *.svc.cluster.local)
        # A fully qualified name pins the namespace, which every overlay
        # overrides. Bare names resolve through the pod's search path.
        missing="$missing $host(fully-qualified)"
        ;;
    esac
  done <<< "$hosts"

  # Every in-cluster address in a ConfigMap must name a Service in this render.
  #
  # Only keys that name an address are examined — `*_HOST`, `*_URL`, `*_URI`,
  # `*_ENDPOINT`. Checking every value cannot tell `POSTGRES_DB: chive` from
  # `REDIS_HOST: redis`, and a validator that flags the first is one people
  # learn to ignore.
  #
  # Kustomize emits document keys alphabetically, so `data:` precedes
  # `kind: ConfigMap`. The document has to be buffered and classified at its
  # end rather than streamed, or values are read before the kind is known.
  #
  # otel-collector lives in k8s/monitoring, which is applied separately, so it
  # is expected to be absent from these renders.
  external="otel-collector"

  while IFS= read -r addr; do
    [ -z "$addr" ] && continue
    echo "$external" | grep -qx "$addr" && continue
    if ! echo "$services" | grep -qx "$addr"; then
      missing="$missing $addr"
    fi
  done <<< "$(echo "$rendered" | awk '
    function flush(   i, v) {
      if (is_cm) {
        for (i = 1; i <= n_vals; i++) {
          v = vals[i]
          sub(/^[a-z]+:\/\//, "", v)
          sub(/\/.*$/, "", v)
          sub(/:[0-9]+$/, "", v)
          # Bare single-label names are in-cluster Services; anything with a
          # dot is an external host, which this check leaves alone.
          if (v ~ /^[a-z][a-z0-9-]*$/) print v
        }
      }
      is_cm = 0; n_vals = 0
    }
    /^---$/ { flush(); next }
    /^kind: ConfigMap$/ { is_cm = 1; next }
    /^  [A-Z0-9_]*(_HOST|_URL|_URI|_ENDPOINT): / {
      v = $0
      sub(/^  [A-Z0-9_]+: /, "", v)
      gsub(/"/, "", v)
      vals[++n_vals] = v
      next
    }
    END { flush() }
  ' | sort -u)"

  if [ -n "$missing" ]; then
    echo "FAIL (unresolvable addresses)"
    for m in $missing; do echo "    $m"; done
    failed=1
  else
    echo "OK"
  fi
done

exit "$failed"
