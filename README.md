# MultiCodex

MultiCodex is a very simple Electron desktop launcher for Codex.

The app has one main action: click the plus button to launch another native Codex desktop process with its own isolated profile directory.

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
2. Common Windows `Codex.exe` install paths
3. `codex` from the system path

To point the launcher at a native Codex executable, set:

```powershell
$env:MULTICODEX_CODEX_COMMAND = "C:\Path\To\Codex.exe"
$env:MULTICODEX_CODEX_ARGS = "--optional --args"
```

Each launched process receives:

- `CODEX_HOME`
- `MULTICODEX_INSTANCE_ID`
- `MULTICODEX_WORKSPACE_PATH`

This keeps profile isolation explicit while avoiding changes to Codex itself.
