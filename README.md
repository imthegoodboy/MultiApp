# MultiCodex

MultiCodex is a very simple Electron desktop launcher for Codex.

The app has one main action: click the plus button to launch another native Codex desktop process with its own isolated profile directory.

Each launch is independent. Clicking plus again starts a new process and does not stop or reuse the already-running Codex windows. The small close button on a launched row closes only that Codex instance. Closing MultiCodex leaves launched Codex windows alone by default.

## Development

Install dependencies:

```powershell
npm install
```

Run the Electron app:

```powershell
npm run dev
```

Build and test:

```powershell
npm run typecheck
npm test
npm run build
```

## Codex Command

The launcher resolves the Codex command in this order:

1. `MULTICODEX_CODEX_COMMAND`
2. Installed Windows packaged app `OpenAI.Codex`
3. Common Windows `Codex.exe` install paths
4. `codex` from the system path

To point the launcher at a native Codex executable, set:

```powershell
$env:MULTICODEX_CODEX_COMMAND = "C:\Path\To\Codex.exe"
$env:MULTICODEX_CODEX_ARGS = "--optional --args"
```

Each launched process receives:

- `CODEX_HOME`
- `OPENAI_CODEX_HOME`
- `ELECTRON_USER_DATA_DIR`
- `MULTICODEX_INSTANCE_ID`
- `MULTICODEX_PROFILE_PATH`
- `MULTICODEX_WORKSPACE_PATH`

When the target is a desktop executable, MultiCodex also passes a unique `--user-data-dir=<profile>\electron-user-data` argument. This keeps profile isolation explicit while avoiding changes to Codex itself.

For test automation only, set `MULTICODEX_KILL_CHILDREN_ON_EXIT=1` to terminate launched child processes when the launcher exits.
