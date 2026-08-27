# Security policy

## Supported versions

Until tagged releases are published, only the latest revision on `main` is supported. Update the plugin before reporting a problem that may already be fixed.

## Reporting a vulnerability

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/mtolhuys/omarchy-onscreen-keyboard/security/advisories/new). Do not disclose security-sensitive details in a public issue.

Include the plugin revision, Omarchy version, affected application, reproduction steps, and expected impact. Do not include passwords, typed text, input-device recordings, credentials, or other private data.

## Security boundary

The plugin runs unsandboxed inside `omarchy-shell` and injects individual key actions into the client that already has focus. It is intended only for an unlocked user session. It cannot provide input at the lock screen, SDDM login, or disk-encryption prompt.

The implementation therefore enforces these invariants:

- Key identifiers are resolved through a closed mapping.
- Each accepted action is sent as a fixed argument vector without a shell parser.
- Typed strings are never assembled, retained, persisted, copied through the clipboard, or logged.
- Unknown keys and malformed detector events are rejected.
- Ctrl, Alt, Shift, and Super are cleared after dispatch, cancellation, hiding, backend failure, disablement, and destruction.
- The plugin does not read raw input devices or request root access, extra groups, or new system permissions.

Authentication surfaces require separate integrations that edit their own password models directly. Global virtual-keyboard injection must not be used to cross those boundaries.
