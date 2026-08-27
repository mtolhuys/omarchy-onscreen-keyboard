# Omarchy Tablet Mode

An on-screen keyboard for using Omarchy as a tablet. It opens from the Omarchy bar, types into the application that already has focus, and can appear automatically when a supported detachable keyboard is removed.

> [!IMPORTANT]
> The keyboard is available only after signing in to the desktop. It does not appear in SDDM, the lock screen, or the disk-encryption prompt.

## Install

This plugin requires an Omarchy version with shell-plugin support. Plugins run inside `omarchy-shell`, so review the source before enabling one.

```bash
omarchy plugin add https://github.com/mtolhuys/omarchy-tablet-mode.git --enable
```

The keyboard icon is placed in the right side of the bar by default.

## Use

Tap or left-click the keyboard icon to show or hide the keyboard. The icon is bright while the keyboard is visible and dim while it is hidden.

The plugin has three modes:

- **Auto** follows the detected hardware-keyboard state.
- **On** keeps tablet mode and the keyboard on.
- **Off** hides the keyboard and ignores automatic detection.

Right-click the bar icon to cycle through the modes. For touch-only control or scripts, set a mode directly:

```bash
omarchy-shell tablet-mode mode auto
omarchy-shell tablet-mode mode on
omarchy-shell tablet-mode mode off
```

If automatic detection is unavailable on your device, use **On** to open the keyboard manually. You can inspect the current mode and detector state with:

```bash
omarchy-shell tablet-mode status
```

The keyboard includes letters, numbers, common punctuation, navigation keys, and one-shot Ctrl, Alt, Shift, and Super modifiers. Tap a modifier and then a key to send a chord. Hold a key that shows a small corner symbol to open its alternative symbols.

## Update

```bash
omarchy plugin update dev.omarchy.tablet-mode
```

## Remove

```bash
omarchy plugin remove dev.omarchy.tablet-mode
```

## Compatibility and limitations

- The current layout is English (US). Layout data is kept separate so additional languages can be added later.
- Automatic attach/detach recovery is confirmed on the ASUS ROG Flow Z13 through Hyprland's device inventory. Other devices can still use manual **On** and **Off** modes.
- The keyboard targets an unlocked Wayland desktop session. Login, lock-screen, and disk-encryption input require separate secure integrations.
- Physical-device geometry can vary with display scale and compositor configuration.

## Development

The portable test suite requires Bash, Node.js, and `jq`:

```bash
./bin/test
```

It runs without a graphical session and contains no private VM or acceptance-harness dependency. Graphical lifecycle and real-toolkit acceptance are maintained separately by the project maintainers.

Security-sensitive design constraints are documented in [SECURITY.md](SECURITY.md).
