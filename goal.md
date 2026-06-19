# MultiCodex Goal

Build a very simple native desktop launcher for Codex.

The app should open as a normal Electron desktop app with a dark UI.

## MVP

- Show one clear plus button.
- When the user clicks the plus button, launch one new Codex desktop app window.
- When the user clicks the plus button again, launch another separate Codex desktop app window.
- Keep each launched Codex process isolated with its own profile directory.
- Pass a unique Electron `--user-data-dir` for every launched desktop process when the target supports it.
- Do not stop already-running Codex windows when the user clicks plus again.
- Do not stop already-running Codex windows just because the launcher window closes.
- Let the user close a launched Codex instance from the simple list.
- Show a small count/list of open Codex windows so the user knows the click worked.
- Keep the UI simple. Do not show workspace grids, advanced controls, dashboards, or many options.

## Native Behavior

- This must work as a desktop app, not as a browser page.
- The plus button must call Electron IPC.
- Electron main must launch native Codex processes from the system.
- Each launch should use a separate profile path.

## Codex Command

The launcher uses this order:

1. `MULTICODEX_CODEX_COMMAND` if set.
2. Installed Windows packaged app `OpenAI.Codex` direct executable.
3. Common Windows `Codex.exe` install paths.
4. The default `codex` command from the system path.

## GitHub Workflow

- Work on a `codex/{phase-description}` branch.
- Commit the MVP.
- Push the branch.
- Open a draft PR with the GitHub CLI.
