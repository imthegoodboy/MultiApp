# MultiCodex

MultiCodex is a small Windows desktop app for launching multiple native Codex desktop windows.

Open MultiCodex, click the large plus button, and a new Codex desktop app process starts with its own isolated profile. Click plus again to start another Codex window without stopping the ones already running. Use the `X` button in the list to close one launched Codex instance.

## Download And Install

Download the latest Windows installer from the GitHub Releases page:

https://github.com/imthegoodboy/MultiApp/releases

Run `MultiCodex-0.1.0-Setup.exe` and follow the setup wizard. The installer creates Start Menu and desktop shortcuts.

Windows may show a SmartScreen warning because this first release is not code-signed. Choose the standard "More info" and "Run anyway" flow only if you trust this repository and release.

## Requirements

MultiCodex launches the native Codex desktop app. Install Codex first, then install MultiCodex.

On Windows, MultiCodex automatically looks for:

1. `MULTICODEX_CODEX_COMMAND`
2. The installed Windows packaged app `OpenAI.Codex`
3. Common `Codex.exe` install paths
4. `codex` from the system path

If Codex is installed somewhere custom, set this before starting MultiCodex:

```powershell
$env:MULTICODEX_CODEX_COMMAND = "C:\Path\To\Codex.exe"
```

## How It Works

Each Codex launch is separate:

- every plus click creates a new Codex process
- every instance gets a unique profile directory
- every desktop executable launch gets a unique `--user-data-dir=<profile>\electron-user-data`
- existing Codex windows keep running when another one is launched
- closing MultiCodex does not close already-launched Codex windows
- the row `X` button closes only that one launched Codex instance

Each launched process receives these environment variables:

- `CODEX_HOME`
- `OPENAI_CODEX_HOME`
- `ELECTRON_USER_DATA_DIR`
- `MULTICODEX_INSTANCE_ID`
- `MULTICODEX_PROFILE_PATH`
- `MULTICODEX_WORKSPACE_PATH`

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
npm run test:e2e
npm run build
```

Build the Windows installer:

```powershell
npm run package
```

The installer is written to the `release` directory.

For test automation only, set `MULTICODEX_KILL_CHILDREN_ON_EXIT=1` to terminate launched child processes when the launcher exits.
