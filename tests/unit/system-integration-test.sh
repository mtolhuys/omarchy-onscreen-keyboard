#!/bin/bash

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
TEST_ROOT=$(mktemp -d)
trap 'rm -rf -- "$TEST_ROOT"' EXIT

export OMARCHY_OSK_SYSTEM_ROOT="$TEST_ROOT/root"
INSTALLER="$ROOT/bin/install-login-keyboard"
UNINSTALLER="$ROOT/bin/uninstall-login-keyboard"
STATUS="$ROOT/bin/login-keyboard-status"
THEME_DIR="$OMARCHY_OSK_SYSTEM_ROOT/usr/share/sddm/themes/omarchy-onscreen-keyboard"
DROPIN="$OMARCHY_OSK_SYSTEM_ROOT/etc/sddm.conf.d/99-z-omarchy-onscreen-keyboard.conf"

if "$STATUS" >/dev/null 2>&1; then
  printf 'status unexpectedly accepted a missing integration\n' >&2
  exit 1
else
  [[ $? -eq 1 ]]
fi

"$INSTALLER" >/dev/null
[[ -f $THEME_DIR/Main.qml && -f $THEME_DIR/Keyboard.qml && -f $THEME_DIR/.integration-manifest ]]
[[ -f $DROPIN ]]
[[ $(stat -c '%a' "$THEME_DIR/Main.qml") == "644" ]]
[[ $(stat -c '%a' "$DROPIN") == "644" ]]
jq -e '.state == "current" and .installedVersion == .sourceVersion' <("$STATUS" --json) >/dev/null
"$INSTALLER" >/dev/null
"$STATUS" >/dev/null
printf 'ok - login keyboard installer is exact, current, and idempotent\n'

printf '\n// local edit\n' >>"$THEME_DIR/Main.qml"
if "$STATUS" >/dev/null 2>&1; then
  printf 'status unexpectedly accepted a modified integration\n' >&2
  exit 1
else
  [[ $? -eq 3 ]]
fi
if "$UNINSTALLER" >/dev/null 2>&1; then
  printf 'uninstaller unexpectedly removed a modified integration without --force\n' >&2
  exit 1
else
  [[ $? -eq 3 ]]
fi
printf 'keep me\n' >"$THEME_DIR/local-note"
"$UNINSTALLER" --force >/dev/null
[[ ! -e $DROPIN && ! -e $THEME_DIR/Main.qml && -f $THEME_DIR/local-note ]]
printf 'ok - modified integration requires force and unrelated files are preserved\n'

rm -f -- "$THEME_DIR/local-note"
rmdir -- "$THEME_DIR"
"$INSTALLER" >/dev/null
sed -i 's/^version=.*/version=0.0.0/' "$THEME_DIR/.integration-manifest"
if "$STATUS" >/dev/null 2>&1; then
  printf 'status unexpectedly accepted an outdated integration\n' >&2
  exit 1
else
  [[ $? -eq 2 ]]
fi
"$UNINSTALLER" >/dev/null
[[ ! -e $DROPIN && ! -e $THEME_DIR ]]
printf 'ok - outdated integration is detected and cleanly removed\n'

if OMARCHY_OSK_SYSTEM_ROOT=relative "$STATUS" >/dev/null 2>&1; then
  printf 'status unexpectedly accepted a relative system root\n' >&2
  exit 1
fi
printf 'ok - system integration rejects an unsafe relative root\n'

SYMLINK_ROOT=$(mktemp -d)
mkdir -p "$SYMLINK_ROOT/usr/share/sddm/themes" "$SYMLINK_ROOT/etc/sddm.conf.d" "$SYMLINK_ROOT/redirected"
ln -s "$SYMLINK_ROOT/redirected" "$SYMLINK_ROOT/usr/share/sddm/themes/omarchy-onscreen-keyboard"
if OMARCHY_OSK_SYSTEM_ROOT="$SYMLINK_ROOT" "$INSTALLER" >/dev/null 2>&1; then
  printf 'installer unexpectedly followed a symlinked theme destination\n' >&2
  exit 1
fi
[[ -z $(find "$SYMLINK_ROOT/redirected" -mindepth 1 -print -quit) ]]
rm -rf -- "$SYMLINK_ROOT"
printf 'ok - system integration refuses symlinked privileged destinations\n'
