import { useEffect } from "react";
import { Loader2, Plus, MonitorUp, X } from "lucide-react";
import { useWorkspaceStore } from "./store/workspaceStore";

export function App() {
  const snapshot = useWorkspaceStore((state) => state.snapshot);
  const isLaunching = useWorkspaceStore((state) => state.isLaunching);
  const hydrateFromHost = useWorkspaceStore((state) => state.hydrateFromHost);
  const launchCodex = useWorkspaceStore((state) => state.launchCodex);
  const closeCodex = useWorkspaceStore((state) => state.closeCodex);

  useEffect(() => {
    void hydrateFromHost();
  }, [hydrateFromHost]);

  const lastEvent = snapshot.events[0];

  return (
    <div className="flex h-screen min-h-[620px] items-center justify-center bg-[#070A0F] p-6 text-white">
      <main className="w-full max-w-[520px] text-center">
        <div className="mx-auto mb-7 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-teal-300">
          <MonitorUp size={24} />
        </div>

        <h1 className="text-3xl font-semibold leading-tight">MultiCodex</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Click plus to open another Codex desktop app window.
        </p>

        <button
          type="button"
          aria-label="Launch Codex"
          onClick={() => void launchCodex()}
          disabled={isLaunching}
          className="mx-auto mt-10 flex h-28 w-28 items-center justify-center rounded-full border border-teal-300/40 bg-teal-400 text-[#041013] shadow-[0_0_60px_rgba(45,212,191,0.22)] transition hover:scale-[1.03] hover:bg-teal-300 disabled:cursor-wait disabled:opacity-70"
        >
          {isLaunching ? <Loader2 size={42} className="animate-spin" /> : <Plus size={52} strokeWidth={2.4} />}
        </button>

        <div className="mt-8 text-sm font-medium text-slate-300">
          {snapshot.instances.length === 0
            ? "No Codex windows open yet"
            : `${snapshot.instances.length} Codex window${snapshot.instances.length === 1 ? "" : "s"} open`}
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-left">
          {snapshot.instances.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">Waiting for first launch.</div>
          ) : (
            snapshot.instances.map((instance) => (
              <div
                key={instance.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-white/10 px-4 py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{instance.name}</div>
                  <div className="truncate text-xs text-slate-500">PID {instance.pid ?? "pending"}</div>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                    instance.status === "crashed"
                      ? "bg-rose-500/15 text-rose-300"
                      : instance.status === "running"
                        ? "bg-teal-400/15 text-teal-300"
                        : "bg-slate-500/15 text-slate-300"
                  }`}
                >
                  {instance.status}
                </span>
                <button
                  type="button"
                  aria-label={`Close ${instance.name}`}
                  title={`Close ${instance.name}`}
                  onClick={() => void closeCodex(instance.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <X size={15} />
                </button>
              </div>
            ))
          )}
        </div>

        {lastEvent ? <p className="mt-4 text-xs text-slate-500">{lastEvent.message}</p> : null}
      </main>
    </div>
  );
}
