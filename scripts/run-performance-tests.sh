#!/usr/bin/env bash
# Run the k6 load scenarios.
#
# `pnpm test:performance` used to invoke `tests/performance/baseline-load.js`,
# which has never existed in this repository — so the performance workflow
# failed on its first command every time it ran, and the four scenarios that do
# exist were never executed.
#
#   ./scripts/run-performance-tests.sh                  # all scenarios
#   ./scripts/run-performance-tests.sh search-query     # one scenario
#
# K6_TARGET_URL selects the target; tests/performance/k6/config.js holds the
# default and the thresholds.

set -euo pipefail

cd "$(dirname "$0")/.."

SCENARIO_DIR=tests/performance/k6/scenarios

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 is not installed: https://grafana.com/docs/k6/latest/set-up/install-k6/" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  scenarios=()
  for name in "$@"; do
    path="$SCENARIO_DIR/${name%.js}.js"
    if [ ! -f "$path" ]; then
      echo "No such scenario: $path" >&2
      echo "Available:" >&2
      ls "$SCENARIO_DIR" | sed 's/^/  /' >&2
      exit 1
    fi
    scenarios+=("$path")
  done
else
  scenarios=("$SCENARIO_DIR"/*.js)
fi

failed=0
for scenario in "${scenarios[@]}"; do
  echo "── $scenario"
  # Keep going after a failure so one slow endpoint does not hide the rest;
  # the exit code still reports that something failed.
  k6 run "$scenario" || failed=1
done

exit "$failed"
