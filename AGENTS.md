# Development rules

These rules apply to the entire repository.

## Before changing runtime code

Read `README.md`, `SECURITY.md`, and `docs/ARCHITECTURE.md` completely. Verify plugin contracts against the current Omarchy source rather than copying assumptions from old revisions.

## Testing and host safety

- `./bin/test` is the complete portable repository suite. It must remain runnable from a clean public checkout with only Bash, Node.js, `jq`, and standard Unix tools.
- Keep private paths, credentials, VM helpers, and unpublished test harness APIs out of this repository.
- Activate, install, update, remove, or visually test development builds only inside a disposable Omarchy environment.
- Never modify a developer's daily Omarchy or Hyprland configuration, restart their shell or compositor, or exercise global shortcuts there.
- Do not require root access, hardware passthrough, or raw input-device access.

## Runtime invariants

- Keep plugin entry points as `Item`s loaded by the existing `omarchy-shell` process.
- Keep tablet detection behind the `auto`, `on`, and `off` policy adapter.
- Keep layouts declarative and keyboard state in pure JavaScript where practical.
- Send only closed semantic key actions. Never use shell evaluation, clipboard transport, completed-string buffering, history, or key logging.
- The keyboard must not take focus from the target application.
- Cancellation, hiding, backend failure, disablement, and destruction must clear queued input and every modifier.
- Preserve the versioned runtime graph so live updates cannot mix cached QML generations.

## Repository changes

- Preserve unrelated user changes and keep commits coherent.
- Do not add generated evidence, device recordings, credentials, or machine-local paths.
- Do not push, publish, or change external repository settings without explicit authorization.
