# Architecture

The plugin is loaded into the existing `omarchy-shell` process as a keep-loaded service and one bar widget. The manifest points both entry points at the same versioned runtime directory so Qt cannot combine a new root component with cached dependencies from an older build.

## Components

- `Service.qml` owns detection, policy, visibility, IPC, the layer-shell window, input dispatch, and window restoration.
- `BarWidget.qml` exposes the touch control through the bar host's click-forwarding contract.
- `KeyboardSurface.qml` and `KeyboardKey.qml` render the layout without requesting keyboard focus.
- `layouts/en-us.json` owns key placement, labels, shifted values, and long-press alternatives.
- Pure JavaScript models validate detector events, policy transitions, layouts, key mappings, dispatch order, and window geometry.

## Input path

The keyboard emits one semantic action at a time. `KeyMapper` accepts only known identifiers and produces a fixed argument vector. Printable actions use one validated character argument; Space and control actions use fixed XKB key names. One-shot modifiers are pressed before the key and released in reverse order.

`KeyDispatch` keeps a bounded queue of already validated actions so rapid taps remain ordered. It never combines actions into text or exposes them through status or logs. Cancellation discards the queue and terminates an active backend process.

Alt+Tab and Omarchy's Super+Space menu family use a closed direct-command mapping instead of virtual modifier injection. Other supported chords use `wtype`, which is part of the Omarchy runtime environment.

## Detection and visibility

The `auto` policy follows normalized Hyprland switch events when available. On the ASUS ROG Flow Z13, the detector can also infer keyboard attachment from the unprivileged `hyprctl -j devices` inventory. Unsupported devices remain safe in an unknown state and can use explicit `on` and `off` modes.

The keyboard is a bottom-anchored, non-focusable layer surface. Its exclusive zone reserves space for tiled clients. A bounded geometry policy compensates for the compositor's bottom gap, fits overlapping floating clients, and temporarily exits fullscreen when necessary. Every adjustment records enough state to restore the client when the keyboard hides or the plugin unloads.

## Public interface

The plugin exposes these commands through `omarchy-shell onscreen-keyboard`:

- `status`
- `show`
- `hide`
- `toggle`
- `mode auto|on|off`

Status contains policy, detector, runtime identity, visibility, modifier, backend, and geometry state. It never contains typed keys or text.
