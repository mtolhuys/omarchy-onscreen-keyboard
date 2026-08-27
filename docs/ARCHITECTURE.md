# Architecture

The plugin is loaded into the existing `omarchy-shell` process as a keep-loaded service and one bar widget. The manifest points both entry points at the same versioned runtime directory so Qt cannot combine a new root component with cached dependencies from an older build.

## Components

- `Service.qml` owns detection, policy, visibility, IPC, the layer-shell window, input dispatch, and window restoration.
- `BarWidget.qml` exposes the touch control through the bar host's click-forwarding contract.
- `KeyboardSurface.qml` and `KeyboardKey.qml` render the layout without requesting keyboard focus.
- `layouts/en-us.json` owns key placement, labels, shifted values, and long-press alternatives.
- `native/osk-input.c` owns the unprivileged Wayland virtual-keyboard connection and complete evdev/XKB keymap.
- `bin/osk-input` builds the helper from bundled source into the user's cache and executes only closed numeric actions.
- Pure JavaScript models validate detector events, visibility transitions, layouts, key mappings, dispatch order, and window geometry.

## Input path

The keyboard emits one semantic action at a time. `KeyMapper` accepts only known identifiers and produces a fixed modifier mask plus evdev keycode. `KeyDispatch` accepts only the closed set of codes represented by the visible layout. The native helper uploads a normal US evdev/XKB keymap through Wayland's virtual-keyboard protocol, then emits that physical key with the requested modifiers. Hyprland therefore sees the same XKB symbols and physical codes used by a hardware keyboard, covering Alt+Tab, Super+Space, Super+3, and custom `code:` bindings.

`KeyDispatch` keeps a bounded queue of already validated actions so rapid taps remain ordered. It never combines actions into text or exposes them through status or logs. Cancellation discards the queue and terminates an active backend process.

The mapper does not contain compositor commands or shortcut-specific exceptions. The helper is compiled on first load from the source and protocol definition bundled in the plugin. Compilation uses the standard Omarchy development toolchain, performs no network access, and writes only to the user's cache. It uses neither a privileged uinput daemon nor direct compositor dispatch, so Hyprland remains the single source of truth for bindings.

## Authentication surfaces

The unlocked desktop, lock screen, and SDDM are separate security contexts and intentionally do not share an input backend.

- The plugin's desktop layer is non-focusable and injects validated virtual key actions into the already-focused client.
- The optional SDDM theme contains its own QML keyboard. It appends characters to the greeter's password model and submits through `sddm.login`; it never starts the desktop input helper or a compositor command.
- The Omarchy lock surface contains a first-party keyboard and edits the lock service's existing PAM password model through semantic signals. Plugin code is not loaded above the session-lock boundary.

`install-login-keyboard` is an explicit privileged operation because SDDM loads system files before a user session exists. It owns only `/usr/share/sddm/themes/omarchy-onscreen-keyboard` and `/etc/sddm.conf.d/99-z-omarchy-onscreen-keyboard.conf`. The late-sorting drop-in overrides Omarchy's packaged theme choice without editing the package-owned file. An installed manifest records the source version and content hashes. Status, upgrades, and removal distinguish current, outdated, locally modified, and absent states.

## Detection and visibility

Normalized Hyprland switch events can show or hide the keyboard when the hardware state changes. On the ASUS ROG Flow Z13, the detector can also infer keyboard attachment from the unprivileged `hyprctl -j devices` inventory. Repeated detector observations do not override a manual show or hide action; a real attach or detach transition does. Unsupported devices remain safe in an unknown state and use the direct controls.

The keyboard is a bottom-anchored, non-focusable layer surface. Its exclusive zone reserves space for tiled clients. A bounded geometry policy compensates for the compositor's bottom gap, fits overlapping floating clients, and temporarily exits fullscreen when necessary. Every adjustment records enough state to restore the client when the keyboard hides or the plugin unloads.

## Public interface

The plugin exposes these commands through `omarchy-shell onscreen-keyboard`:

- `status`
- `show`
- `hide`
- `toggle`

Status contains policy, detector, runtime identity, visibility, modifier, backend, and geometry state. It never contains typed keys or text.
