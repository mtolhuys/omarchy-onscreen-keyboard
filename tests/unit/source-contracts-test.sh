#!/bin/bash

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
VERSION=$(jq -er '.version' "$ROOT/manifest.json")
SERVICE_ENTRY=$(jq -er '.entryPoints.service' "$ROOT/manifest.json")
WIDGET_ENTRY=$(jq -er '.entryPoints.barWidget' "$ROOT/manifest.json")

reject_grep() {
  if grep "$@"; then
    return 1
  else
    [[ $? -eq 1 ]]
  fi
}

jq -e '
  .schemaVersion == 1 and
  .id == "dev.omarchy.tablet-mode" and
  (.kinds | sort) == (["bar-widget", "service"] | sort) and
  .keepLoaded == true and
  (.entryPoints.service | test("^v[0-9]+/Service\\.qml$")) and
  (.entryPoints.barWidget | test("^v[0-9]+/BarWidget\\.qml$"))
' "$ROOT/manifest.json" >/dev/null
printf 'ok - manifest declares the service and bar-widget contract\n'

SERVICE="$ROOT/$SERVICE_ENTRY"
WIDGET="$ROOT/$WIDGET_ENTRY"
RUNTIME_DIR=$(dirname "$SERVICE")
test "$(dirname "$WIDGET")" = "$RUNTIME_DIR"
grep -q '^Item {' "$SERVICE"
grep -q '^Item {' "$WIDGET"
grep -q 'property QtObject bar: null' "$WIDGET"
grep -q 'property string moduleName:' "$WIDGET"
grep -q 'property var settings:' "$WIDGET"
reject_grep -q '^BarWidget {' "$WIDGET"
reject_grep -R -n -E 'ShellRoot|/dev/input|eval\(|bash[[:space:]]+-c|wl-copy|wl-paste|clipboard' \
  "$SERVICE" "$WIDGET" "$RUNTIME_DIR/KeyboardSurface.qml" \
  "$RUNTIME_DIR/KeyboardKey.qml" "$RUNTIME_DIR/models" "$ROOT/layouts"
printf 'ok - runtime uses Item entry points and contains no forbidden input path\n'

grep -q 'WlrLayershell.keyboardFocus: WlrKeyboardFocus.None' "$SERVICE"
grep -q 'KeyMapper.commandFor' "$SERVICE"
grep -q 'keyProcess.command = command' "$SERVICE"
grep -q 'KeyDispatch.enqueue' "$SERVICE"
grep -q 'KeyDispatch.cancel' "$SERVICE"
printf 'ok - keyboard is non-focusable and serializes only mapped argv actions\n'

grep -q 'target: Hyprland' "$SERVICE"
grep -q 'TabletDetector.parseSwitchEvent' "$SERVICE"
reject_grep -R -n -E 'socket2|socat|event[0-9]+' "$SERVICE" "$RUNTIME_DIR/models/TabletDetector.js"
printf 'ok - detector consumes the shared Hyprland event service only\n'

grep -q '\["hyprctl", "-j", "devices"\]' "$SERVICE"
grep -q 'TabletDetector.fromDeviceInventory' "$SERVICE"
printf 'ok - detector recovers Z13 attach state through the unprivileged Hyprland inventory\n'

grep -q 'function status(): string' "$SERVICE"
grep -q 'function show(): string' "$SERVICE"
grep -q 'function hide(): string' "$SERVICE"
grep -q 'function toggle(): string' "$SERVICE"
grep -q 'function mode(value: string): string' "$SERVICE"
grep -q 'function toggleTouchKeyboard()' "$SERVICE"
grep -q "readonly property string runtimeBuild: \"$VERSION\"" "$SERVICE"
grep -q 'runtimeBuild: root.runtimeBuild' "$SERVICE"
grep -q 'widgetBuild: root.widgetBuild' "$SERVICE"
printf 'ok - stable IPC surface is present\n'

grep -q 'implicitWidth: Style.bar.statusSlot' "$WIDGET"
grep -q 'implicitHeight: Style.bar.sizeHorizontal' "$WIDGET"
reject_grep -q 'implicitWidth: barSize' "$WIDGET"
reject_grep -q 'showTooltip' "$WIDGET"
grep -q 'function triggerPress(button)' "$WIDGET"
grep -q 'controller.toggleTouchKeyboard()' "$WIDGET"
reject_grep -q 'MouseArea {' "$WIDGET"
reject_grep -q 'text: root.modeLabel' "$WIDGET"
grep -q 'onBarChanged:' "$WIDGET"
grep -q 'barForeground = host ? host.barForeground' "$WIDGET"
grep -q 'controller.registerWidgetBuild(runtimeBuild)' "$WIDGET"
reject_grep -q 'root.bar.barForeground' "$WIDGET"
printf 'ok - bar widget is icon-only, reload-safe, full-height, and uses host click forwarding\n'

reject_grep -q 'enabled: !root.controller.backendBusy' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'maximumContentWidth' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'rowInsets' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'Math.max(Style.space(44)' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'navigationCluster' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'KeyboardLayout.navigationWidth' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'inverted-t' "$ROOT/layouts/en-us.json"
for modifier in ctrl alt shift super; do
  jq -e --arg id "$modifier" '[.rows[][] | select(.id == $id and .kind == "modifier")] | length == 1' \
    "$ROOT/layouts/en-us.json" >/dev/null
done
grep -q 'selected: modelData.kind === "modifier"' "$RUNTIME_DIR/KeyboardSurface.qml"
printf 'ok - keyboard keeps a stable visual state and uses compact staggered rows with native navigation\n'

grep -q 'id: longPressTimer' "$RUNTIME_DIR/KeyboardKey.qml"
grep -q 'signal held()' "$RUNTIME_DIR/KeyboardKey.qml"
grep -q 'property string alternateHint:' "$RUNTIME_DIR/KeyboardKey.qml"
grep -q 'id: alternativesPopup' "$RUNTIME_DIR/KeyboardSurface.qml"
grep -q 'alternatesVisible: root.alternativesVisible' "$SERVICE"
jq -e '[.rows[][] | .alternatives? // empty | .[]] | length >= 20' "$ROOT/layouts/en-us.json" >/dev/null
printf 'ok - long press opens layout-owned developer alternatives with public visibility state\n'

grep -q 'space: \[" ", " "\]' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q 'action.id === "space".*command.push("-k", "space")' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q 'WTYPE_MODIFIERS.*super: "logo"' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q '"alt+tab": \["hyprctl", "dispatch", "hl.dsp.window.cycle_next()"\]' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q '"super+space": \["omarchy-menu", "toggle"\]' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q '"ctrl+shift+super+space": \["omarchy-menu", "toggle", "theme"\]' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q 'for (var released = modifiers.length - 1; released >= 0; released--)' "$RUNTIME_DIR/models/KeyMapper.js"
grep -q 'function cancelInput()' "$SERVICE"
grep -q 'Component.onDestruction:' "$SERVICE"
printf 'ok - Space and one-shot modifiers use closed argv mappings with reverse release cleanup\n'

grep -q 'WindowAvoidance.plan' "$SERVICE"
grep -q 'function restoreWindow' "$SERVICE"
grep -q 'WindowAvoidance.bottomOuterGap' "$SERVICE"
grep -q 'WindowAvoidance.tiledSeamCorrection' "$SERVICE"
grep -q 'command: \["hyprctl", "-j", "getoption", "general:gaps_out"\]' "$SERVICE"
grep -q 'property int measuredSeamCorrection: 0' "$SERVICE"
grep -q 'exclusiveZone: WindowAvoidance.exclusiveZone(' "$SERVICE"
grep -q 'root.bottomOuterGap + root.measuredSeamCorrection' "$SERVICE"
grep -q 'seamCorrection: root.measuredSeamCorrection' "$SERVICE"
grep -q 'id: seamProbeTimer' "$SERVICE"
reject_grep -q 'exclusiveZone: WindowAvoidance.exclusiveZone(height, Style.gapsOut)' "$SERVICE"
grep -q 'exclusionMode: ExclusionMode.Normal' "$SERVICE"
printf 'ok - keyboard applies gap-compensated reversible overlap avoidance\n'

reject_grep -q 'controller.policyLabel' "$RUNTIME_DIR/KeyboardSurface.qml"
reject_grep -q 'Tablet keyboard\|Use Auto\|Force On\|Hide\|headerHeight' "$RUNTIME_DIR/KeyboardSurface.qml"
printf 'ok - keyboard surface contains only the keyboard; mode and dismissal stay on the bar\n'

reject_grep -q 'readonly property bool policyEnabled' "$WIDGET"
grep -q 'root.keyboardVisible ? Style.selectedFillFor' "$WIDGET"
grep -q 'color: root.barForeground' "$WIDGET"
grep -q 'opacity: root.keyboardVisible ? 1 : 0.45' "$WIDGET"
reject_grep -q 'property color forcedColor' "$WIDGET"
grep -q 'TabletPolicy.label(policy)' "$SERVICE"
printf 'ok - bar icon is bright when visible and dim when hidden\n'

README="$ROOT/README.md"
grep -Fq 'omarchy plugin add https://github.com/mtolhuys/omarchy-tablet-mode.git --enable' "$README"
grep -Fq 'omarchy plugin update dev.omarchy.tablet-mode' "$README"
grep -Fq 'omarchy plugin remove dev.omarchy.tablet-mode' "$README"
reject_grep -Fq '<path-to-this-repo>' "$README"
reject_grep -Fq 'TABLET_PLUGIN_GUEST_DIR=' "$README"
reject_grep -Eq '/home/|test-runs/' "$README"
printf 'ok - README uses public lifecycle commands and portable test instructions\n'
