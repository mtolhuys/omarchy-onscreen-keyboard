#!/bin/bash

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
SELF=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/$(basename -- "${BASH_SOURCE[0]}")

if find "$ROOT" -path "$ROOT/.git" -prune -o -type f ! -path "$SELF" -print0 |
    xargs -0 grep -nHE \
      '(/home/[^/[:space:]]+/Projects/|plugin[-]lab|OMARCHY_LAB_|omarchy_host_test|ssh_guest|ssh_session|wait_for_guest_state|capture_console|GUEST_PASSWORD)'; then
  printf 'private acceptance-harness dependency found in the public checkout\n' >&2
  exit 1
fi

if find "$ROOT" -path "$ROOT/.git" -prune -o -type f ! -path "$SELF" -print0 |
    xargs -0 grep -nHE \
      '(omarchy[-]tablet[-]mode|dev[.]omarchy[.]tablet[-]mode|omarchy-shell tablet[-]mode|omarchy[-]tablet[-]keyboard|TabletDetector|TabletPolicy|tabletActive|TABLET_PLUGIN_)'; then
  printf 'obsolete product identity found in the public checkout\n' >&2
  exit 1
fi

for private_path in \
  "$ROOT/tests/lab" \
  "$ROOT/bin/report-gap" \
  "$ROOT/bin/verify-live-update"; do
  if [[ -e $private_path ]]; then
    printf 'private acceptance asset remains public: %s\n' "$private_path" >&2
    exit 1
  fi
done

printf 'ok - public checkout contains only portable test infrastructure\n'
