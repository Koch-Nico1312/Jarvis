import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Cpu,
  HardDrive,
  MessageSquareText,
  Mic,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import type { DashboardResponse } from "../lib/types";

export function HomeView({
  dashboard,
  onStartNewChat,
}: {
  dashboard: DashboardResponse | null;
  onStartNewChat: () => void;
}) {
  const resources = dashboard?.resources;
  const state = dashboard?.state;
  const recentSessions = dashboard?.recent_sessions ?? [];

  const resourceCards = [
    {
      label: "CPU",
      value: `${resources?.cpu_percent?.toFixed?.(1) ?? "0.0"}%`,
      tone: "from-cyan-400/20 to-cyan-400/5",
      icon: Cpu,
    },
    {
      label: "RAM",
      value: `${resources?.memory_percent?.toFixed?.(1) ?? "0.0"}%`,
      tone: "from-emerald-400/20 to-emerald-400/5",
      icon: HardDrive,
    },
    {
      label: "Disk",
      value: `${resources?.disk_percent?.toFixed?.(1) ?? "0.0"}%`,
      tone: "from-amber-400/20 to-amber-400/5",
      icon: Activity,
    },
    {
      label: "Threads",
      value: `${resources?.threads ?? 0}`,
      tone: "from-violet-400/20 to-violet-400/5",
      icon: Sparkles,
    },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-5 md:p-7">
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(0,212,255,0.12),rgba(255,255,255,0.04))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100">
                  <Mic className="h-4 w-4" />
                  Voice first
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  JARVIS ist bereit zum Sprechen.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  Der Fokus liegt auf Sprache. Textchat bleibt optional, die
                  laufende Unterhaltung wird nicht unterbrochen, wenn du in
                  andere Bereiche wechselst.
                </p>
              </div>

              <div className="grid min-w-[220px] gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Status
                  </div>
                  <div className="mt-1 text-lg font-semibold text-cyan-100">
                    {state?.state ?? "LISTENING"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Voice mode
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {state?.speaking ? "On air" : "Listening"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={onStartNewChat}
                className="rounded-2xl bg-cyan-400/90 px-5 text-slate-950 hover:bg-cyan-300"
              >
                Neuen Chat starten
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Chatten bleibt optional. Sprachmodus ist Standard.
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <Calendar className="h-4 w-4 text-cyan-200" />
                Calendar status
              </div>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Google Calendar</span>
                  <span className={dashboard?.calendar.authenticated ? "text-emerald-300" : "text-amber-300"}>
                    {dashboard?.calendar.authenticated ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Credentials</span>
                  <span className="text-slate-400">
                    {dashboard?.calendar.configured ? "Configured" : "Missing"}
                  </span>
                </div>
                <div className="text-xs leading-5 text-slate-400">
                  Verknüpfen und Pfade setzen geht über die Einstellungen.
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
                <MessageSquareText className="h-4 w-4 text-cyan-200" />
                Aktive Sitzung
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="text-lg font-semibold text-white">
                  {dashboard?.current_session?.title ?? "No active chat"}
                </div>
                <p className="text-slate-400">
                  {dashboard?.current_session?.preview ?? "Starte mit einem gesprochenen Satz, damit der Verlauf beginnt."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {resourceCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${card.tone} p-5`}
            >
              <div className="mb-4 flex items-center justify-between">
                <card.icon className="h-5 w-5 text-white/90" />
                <span className="text-xs uppercase tracking-[0.25em] text-slate-300">
                  Live
                </span>
              </div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-300">
                {card.label}
              </div>
              <div className="mt-2 text-3xl font-semibold text-white">
                {card.value}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Activity className="h-4 w-4 text-cyan-200" />
              Letzte Chats
            </div>
            <div className="space-y-3">
              {recentSessions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
                  Noch keine gespeicherten Chats vorhanden.
                </div>
              ) : (
                recentSessions.slice(0, 6).map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">
                          {session.title}
                        </div>
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-400">
                          {session.message_count ?? 0} messages
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                        {session.status ?? "archived"}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {session.preview ?? "No preview available."}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Systemhinweise
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-medium text-white">Sprachmodus zuerst</div>
                <p className="mt-1 text-slate-400">
                  Der Assistent bleibt aktiv, auch wenn du die Tabs wechselst.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-medium text-white">Chat optional</div>
                <p className="mt-1 text-slate-400">
                  Textkommandos sind verfügbar, aber nicht der primäre Workflow.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="font-medium text-white">Settings</div>
                <p className="mt-1 text-slate-400">
                  Google Calendar und UI-Persistenz werden über die Einstellungen
                  verbunden.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
