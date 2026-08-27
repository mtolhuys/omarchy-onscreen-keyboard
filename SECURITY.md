# Security policy

## Supported versions

Until tagged releases are published, only the latest revision on `main` is supported. Update the plugin before reporting a problem that may already be fixed.

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/mtolhuys/omarchy-onscreen-keyboard/security/advisories/new). Do not disclose security-sensitive details in a public issue.

Include the plugin revision, Omarchy version, affected application, reproduction steps, and expected impact. Do not include passwords, typed text, input-device recordings, credentials, or other private data.

## Security boundary

The plugin runs unsandboxed inside `omarchy-shell` and injects individual key actions into the client that already has focus. That mechanism is intended only for an unlocked user session and cannot cross the lock or login boundaries.

The implementation therefore enforces these invariants:

- Key identifiers are resolved through a closed mapping.
- Each accepted action is sent as a fixed argument vector without a shell parser.
- Typed strings are never assembled, retained, persisted, copied through the clipboard, or logged.
- Unknown keys and malformed detector events are rejected.
- Every desktop action resolves to a closed modifier mask and evdev keycode. The bundled helper uploads a normal US evdev/XKB keymap, so the compositor remains the authority for symbol and physical-code bindings.
- Ctrl, Alt, Shift, and Super are one-shot UI state and are cleared after dispatch, cancellation, hiding, backend failure, disablement, and destruction.
- The helper is compiled locally from bundled source into the user's cache. It does not download code, read raw input devices, use uinput, or request root access, extra groups, or new system permissions.

The optional SDDM installer is separate from plugin activation and requires an explicit `sudo` command. It installs a dedicated theme and configuration drop-in, tracks hashes of owned files, refuses to overwrite locally modified owned files unless `--force` is supplied, and never restarts SDDM. Its keyboard edits only the greeter password model and submits through the SDDM API.

The lock-screen keyboard is trusted Omarchy code and edits the existing PAM password model directly. Global virtual-keyboard injection and user plugin code are not used above the session lock. Neither integration stores or logs password text.

Disk-encryption input is outside this project's scope because it runs in the initramfs before the plugin, Omarchy shell, and SDDM exist.
