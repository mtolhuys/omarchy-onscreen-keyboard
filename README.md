# Omarchy On-Screen Keyboard

A touch-first keyboard for Omarchy's desktop, with an optional login-screen integration. Open it from the bar, type into the application that already has focus, and use normal application and Omarchy shortcuts without reaching for a physical keyboard.

## Install

This plugin requires an Omarchy version with shell-plugin support. Plugins run inside `omarchy-shell`, so review the source before enabling one.

```bash
omarchy plugin add https://github.com/mtolhuys/omarchy-onscreen-keyboard.git --enable
```

The keyboard icon is placed in the right side of the bar by default.

## Highlights

- Types individual key actions into the focused application without taking focus itself.
- Provides one-shot Ctrl, Alt, Shift, and Super modifiers for shortcuts and navigation.
- Sends a complete evdev-compatible virtual keyboard map so Hyprland resolves both symbol bindings and physical `code:` bindings such as Super+3.
- Includes function keys, editing keys, navigation keys, and long-press alternatives.
- Offers developer symbols through long press without crowding the primary layout.
- Can react to a supported detachable keyboard while retaining direct show and hide controls.
- Includes a self-contained SDDM theme for touch login without desktop-session input injection.

## Use

Tap or left-click the keyboard icon to show or hide the keyboard. The icon is bright while the keyboard is visible and dim while it is hidden. On supported detachable hardware, an actual attach or detach transition also hides or shows it.

For scripts, use the same direct controls:

```bash
omarchy-shell onscreen-keyboard show
omarchy-shell onscreen-keyboard hide
omarchy-shell onscreen-keyboard toggle
omarchy-shell onscreen-keyboard status
```

The keyboard includes letters, numbers, common punctuation, navigation keys, and one-shot Ctrl, Alt, Shift, and Super modifiers. Tap a modifier and then a key to send a chord. Hold a key that shows a small corner symbol to open its alternative symbols.

## Add it to the login screen

The plugin works without root after login. Adding it to SDDM is a separate, explicit system integration:

```bash
cd /path/to/omarchy-onscreen-keyboard
sudo ./bin/install-login-keyboard
./bin/login-keyboard-status
```

Log out to see the keyboard button on the login screen. A reboot also shows it when SDDM autologin is disabled. Encrypted Omarchy installations normally keep SDDM autologin enabled because disk encryption is treated as the boot authentication boundary; in that configuration a reboot skips the greeter entirely.

To deliberately exercise the complete reboot-to-SDDM path, first confirm that the keyboard works after logging out. Then temporarily disable autologin by moving its drop-in out of SDDM's `*.conf` set:

```bash
sudo mv /etc/sddm.conf.d/autologin.conf /etc/sddm.conf.d/autologin.conf.disabled
sudo reboot
```

Restore the normal encrypted-install behavior after the test:

```bash
sudo mv /etc/sddm.conf.d/autologin.conf.disabled /etc/sddm.conf.d/autologin.conf
```

The installer does not restart SDDM, access the network, modify the stock Omarchy theme, or change autologin. It installs a dedicated theme and one SDDM configuration drop-in, records hashes for every owned file, and can be run again safely after a plugin update.

To remove it:

```bash
sudo ./bin/uninstall-login-keyboard
```

Both install and uninstall stop if their owned files were changed locally. Inspect the files first, then use `--force` only when replacing or removing those known paths is intentional.

## Lock screen and early boot

The lock-screen keyboard belongs to Omarchy itself, not to an untrusted desktop plugin. Compatible Omarchy releases show a keyboard button on the trusted lock surface and edit the PAM password model directly. Keep Omarchy updated to obtain that integration; there is no extra `sudo` command for it.

The disk-encryption prompt happens before Omarchy, SDDM, or this plugin starts. It is not covered. Systems that must unlock without a physical keyboard need a separate early-boot design, such as hardware-backed automatic unlock or a deliberately configured initramfs input solution.

## Update

```bash
omarchy plugin update dev.omarchy.onscreen-keyboard
```

## Remove

```bash
omarchy plugin remove dev.omarchy.onscreen-keyboard
```

## Compatibility and limitations

- The current layout is English (US). Layout data is kept separate so additional languages can be added later.
- The desktop input helper is built locally from the bundled source on first load. Omarchy's standard `base-devel`, Wayland, and xkbcommon packages provide the compiler and headers; no download or root access is used.
- Attach/detach reactions are confirmed on the ASUS ROG Flow Z13 through Hyprland's device inventory. Other devices can use the bar icon or direct commands.
- Desktop injection cannot and does not cross into SDDM or the lock screen. Those surfaces use their own direct password-model integrations.
- The bundled SDDM integration replaces the active greeter theme with a keyboard-enabled Omarchy theme. A later Omarchy theme update is not copied automatically; rerun the installer after updating this plugin.
- Physical-device geometry can vary with display scale and compositor configuration.

## Development

The portable test suite requires Bash, Node.js, `jq`, a C compiler, `wayland-scanner`, Wayland development files, and xkbcommon development files. These are present in a standard Omarchy installation:

```bash
./bin/test
```

It runs without a graphical session and contains no private VM or acceptance-harness dependency. Graphical lifecycle and real-toolkit acceptance are maintained separately by the project maintainers.

Security-sensitive design constraints are documented in [SECURITY.md](SECURITY.md).
