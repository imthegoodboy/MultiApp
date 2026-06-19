import { useEffect } from "react";
import { Plus, MonitorUp, X } from "lucide-react";
import { useWorkspaceStore } from "./store/workspaceStore";

export function App() {
  const snapshot = useWorkspaceStore((state) => state.snapshot);
  const pendingLaunches = useWorkspaceStore((state) => state.pendingLaunches);
  const hydrateFromHost = useWorkspaceStore((state) => state.hydrateFromHost);
  const launchCodex = useWorkspaceStore((state) => state.launchCodex);
  const closeCodex = useWorkspaceStore((state) => state.closeCodex);

  useEffect(() => {
    void hydrateFromHost();
  }, [hydrateFromHost]);

  const lastEvent = snapshot.events[0];
  const openCount = snapshot.instances.length;
  const openWindowLabel =
    openCount === 0 ? "No Codex windows open yet" : `${openCount} Codex window${openCount === 1 ? "" : "s"} open`;
  const launchStateLabel = pendingLaunches > 0 ? "Launching" : "Ready";

  return (
    <div className="flex h-screen min-h-[620px] items-center justify-center bg-[#070A0F] p-5 text-slate-100">
      <main className="flex h-full w-full max-w-[520px] flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-teal-300">
              <MonitorUp size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold leading-tight">MultiCodex</h1>
              <p className="text-xs font-medium uppercase text-slate-500">{launchStateLabel}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <div className="text-lg font-semibold leading-none text-white">{openCount}</div>
            <div className="mt-1 text-[11px] font-medium uppercase text-slate-500">Open</div>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <button
            type="button"
            aria-label="Launch Codex"
            aria-busy={pendingLaunches > 0}
            onClick={() => void launchCodex()}
            className="flex h-28 w-28 items-center justify-center rounded-full border border-teal-200/50 bg-teal-300 text-[#03110F] shadow-[0_18px_80px_rgba(20,184,166,0.24)] transition hover:scale-[1.03] hover:bg-teal-200 focus:outline-none focus:ring-4 focus:ring-teal-300/20"
          >
            <Plus size={54} strokeWidth={2.35} />
          </button>

          <div className="mt-7 text-sm font-medium text-slate-300">{openWindowLabel}</div>
          {lastEvent ? <p className="mt-2 max-w-sm truncate text-xs text-slate-500">{lastEvent.message}</p> : null}
        </section>

        <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] text-left shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Codex Windows</div>
            <div className="text-xs font-medium text-slate-400">{openCount} open</div>
          </div>

          {openCount === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">Nothing running.</div>
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
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                >
                  <X size={15} />
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
