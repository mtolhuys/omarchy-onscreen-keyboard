#!/usr/bin/env bash

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
TEST_ROOT=$(mktemp -d)
trap 'rm -r -- "$TEST_ROOT"' EXIT

XDG_CACHE_HOME="$TEST_ROOT/cache" "$ROOT/bin/osk-input" --prepare
BINARY="$TEST_ROOT/cache/omarchy-onscreen-keyboard/0.2.1/osk-input"

[[ -x $BINARY ]]
if "$BINARY" 78 4 >"$TEST_ROOT/stdout" 2>"$TEST_ROOT/stderr"; then
  echo "native backend accepted a modifier mask outside the closed set" >&2
  exit 1
fi
grep -Fxq 'osk-input: invalid closed key action' "$TEST_ROOT/stderr"

printf 'ok - native evdev backend builds locally and rejects open input\n'
