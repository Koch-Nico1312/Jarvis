import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Boxes,
  BrainCircuit,
  Braces,
  Bug,
  ChartNoAxesCombined,
  CloudCog,
  Code2,
  DatabaseZap,
  FileCode2,
  GitBranch,
  Globe2,
  KeyRound,
  LibraryBig,
  Network,
  PackagePlus,
  Play,
  RefreshCcw,
  Rocket,
  Save,
  Share2,
  ShieldCheck,
  Smartphone,
  TestTubeDiagonal,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { jarvisApi } from "../lib/api";
import type {
  PlatformAgent,
  PlatformPayload,
  PlatformTool,
  PlatformWorkflow,
} from "../lib/types";

type StudioTab =
  | "agents"
  | "access"
  | "extensions"
  | "tools"
  | "workflows"
  | "quality"
  | "knowledge"
  | "workspace"
  | "publish"
  | "enterprise";

const tabs: Array<{ id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "agents", label: "Agents", icon: BrainCircuit },
  { id: "access", label: "Zugriff", icon: UsersRound },
  { id: "extensions", label: "Erweiterungen", icon: PackagePlus },
  { id: "tools", label: "Tools", icon: Braces },
  { id: "workflows", label: "Flows", icon: Workflow },
  { id: "quality", label: "Qualitaet & Kosten", icon: ChartNoAxesCombined },
  { id: "knowledge", label: "Knowledge", icon: DatabaseZap },
  { id: "workspace", label: "Workspace & Sandbox", icon: FileCode2 },
  { id: "publish", label: "Publishing", icon: Rocket },
  { id: "enterprise", label: "Optionales", icon: ShieldCheck },
];

const openApiSeed = JSON.stringify(
  {
    openapi: "3.0.0",
    info: { title: "Jarvis Demo API", version: "1.0.0" },
    paths: {
      "/tickets/{id}": {
        get: {
          operationId: "getTicket",
          summary: "Fetch a support ticket by id",
        },
      },
      "/tickets": {
        post: {
          operationId: "createTicket",
          summary: "Create a support ticket",
        },
      },
    },
  },
  null,
  2,
);

function Panel({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-white/10 bg-[#071b27]/80">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-cyan-200" />
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  icon: Icon = Play,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const classes =
    "mt-1 w-full rounded-lg border border-white/10 bg-[#03111a] px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40";
  return (
    <label className="block text-xs font-medium text-slate-300">
      {label}
      {multiline ? (
        <textarea className={`${classes} min-h-28 resize-none`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={classes} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone = value.includes("ready") || value.includes("synced") || value.includes("published") || value.includes("passing")
    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
    : value.includes("draft") || value.includes("planned")
      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
      : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";
  return <span className={`rounded-full border px-2 py-1 text-[11px] ${tone}`}>{value}</span>;
}

export function StudioView() {
  const [platform, setPlatform] = useState<PlatformPayload | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>("agents");
  const [agentDraft, setAgentDraft] = useState<PlatformAgent | null>(null);
  const [toolDraft, setToolDraft] = useState<PlatformTool | null>(null);
  const [openApiSpec, setOpenApiSpec] = useState(openApiSeed);
  const [sandboxLanguage, setSandboxLanguage] = useState<"python" | "javascript">("python");
  const [sandboxCode, setSandboxCode] = useState("print('Jarvis sandbox ready')\nprint(2 + 2)");
  const [mcpQuery, setMcpQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [quickstartResult, setQuickstartResult] = useState<Record<string, unknown> | null>(null);
  const [soloAuditResult, setSoloAuditResult] = useState<Record<string, unknown> | null>(null);
  const [userDraft, setUserDraft] = useState({ name: "New User", email: "user@jarvis.local", roles: "viewer", groups: "core" });
  const [roleDraft, setRoleDraft] = useState({ id: "operator", permissions: "read, agents:read, workflows:read" });
  const [knowledgeDraft, setKnowledgeDraft] = useState({ source: "GitHub", target: "New Repository", uri: "https://github.com/org/repo", vector_db: "qdrant", schedule: "hourly" });
  const [identityDraft, setIdentityDraft] = useState({
    name: "Company OIDC",
    type: "oidc",
    issuer: "https://login.example.com",
    client_id: "jarvis",
    audience: "jarvis",
    jwks_uri: "https://login.example.com/.well-known/jwks.json",
    ldap_url: "",
  });
  const [scimDraft, setScimDraft] = useState({ name: "SCIM User", email: "scim.user@jarvis.local", roles: "viewer", groups: "core" });
  const [chainGoal, setChainGoal] = useState("Research the issue, draft a compact answer, and return final context.");
  const [ingestFiles, setIngestFiles] = useState("contract.pdf, scan-table.png, notes.docx");
  const [workflowNodeDraft, setWorkflowNodeDraft] = useState({ label: "Classifier", type: "branch", source: "route", target: "publish", edgeLabel: "approved" });
  const [knowledgeQuery, setKnowledgeQuery] = useState("hybrid rag vector reranker");

  const load = async () => {
    const next = await jarvisApi.getPlatform();
    setPlatform(next);
    setAgentDraft(next.agents[0] ?? null);
    setToolDraft(next.tools[0] ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (action: string, payload: Record<string, unknown>) => {
    try {
      const response = await jarvisApi.platformAction(action, payload);
      setPlatform(response.platform);
      if (response.error) {
        setErrorNotice(`${action}: ${response.error}`);
        window.setTimeout(() => setErrorNotice(null), 5200);
        return response;
      }
      if ((action === "save_tool" || action === "test_tool") && response.result && typeof response.result === "object" && "id" in response.result) {
        setToolDraft(response.result as PlatformTool);
      }
      if (action === "save_agent" && response.result && typeof response.result === "object" && "id" in response.result) {
        setAgentDraft(response.result as PlatformAgent);
      }
      if (action === "import_agent_package" && response.result && typeof response.result === "object" && "agent" in response.result) {
        setAgentDraft((response.result as { agent: PlatformAgent }).agent);
      }
      if (action === "create_companion_pairing" && response.result && typeof response.result === "object" && "code" in response.result) {
        setNotice(`Pairing-Code: ${(response.result as { code: string }).code}`);
        setErrorNotice(null);
        window.setTimeout(() => setNotice(null), 9000);
        return response;
      }
      if (action === "run_solo_quickstart" && response.result && typeof response.result === "object") {
        setQuickstartResult(response.result as Record<string, unknown>);
      }
      if (action === "run_solo_audit" && response.result && typeof response.result === "object") {
        setSoloAuditResult(response.result as Record<string, unknown>);
      }
      setNotice(`${action} abgeschlossen`);
      setErrorNotice(null);
      window.setTimeout(() => setNotice(null), 2600);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen";
      setErrorNotice(message);
      window.setTimeout(() => setErrorNotice(null), 5200);
      return null;
    }
  };

  const metricRows = useMemo(() => platform?.metrics ?? [], [platform]);
  const totalCost = metricRows.reduce((sum, row) => sum + row.cost, 0);
  const totalTokens = metricRows.reduce((sum, row) => sum + row.tokens, 0);
  const companionSessions = Array.isArray(platform?.companion?.sessions)
    ? platform.companion.sessions as Array<{ id: string; status: string; device_name?: string }>
    : [];
  const companionSessionId = companionSessions.find((session) => session.status === "active")?.id ?? "";
  const ssoFlows = Array.isArray(platform?.sso?.login_flows)
    ? platform.sso.login_flows as Array<{ id: string; state: string; status: string; provider_id: string }>
    : [];
  const ssoSessions = Array.isArray(platform?.sso?.sessions)
    ? platform.sso.sessions as Array<{ id: string; email: string; status: string; provider_id: string }>
    : [];
  const ssoEvents = Array.isArray(platform?.sso?.events)
    ? platform.sso.events as Array<{ id: string; action: string; status: string; provider_id: string }>
    : [];
  const pendingSsoFlow = ssoFlows.find((flow) => flow.status === "pending");
  const soloStatus = platform.solo_status;
  const quickstartSummary = quickstartResult?.summary as
    | {
        title?: string;
        agent_output?: string;
        knowledge_results?: number;
        ingested_documents?: number;
        sandbox_stdout?: string;
        workflow_status?: string;
        artifact_id?: string;
      }
    | undefined;
  const quickstartActions = (quickstartResult?.next_actions as Array<{ label: string; href?: string; target?: string; kind: string }> | undefined) ?? [];
  const activeSoloAudit = (soloAuditResult as {
    status?: string;
    ready_count?: number;
    optional_count?: number;
    blocking_count?: number;
    total_count?: number;
    items?: Array<{ id: string; label: string; status: string; evidence: string[]; recommendation: string; verified: boolean }>;
  } | null) ?? platform.solo_audits?.[0] ?? null;

  if (!platform) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-300">
        Jarvis Studio wird geladen...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-white/10 bg-[#06131d] px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-cyan-200/70">
              <Boxes className="h-4 w-4" />
              Jarvis Studio · Solo
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-white">{soloStatus?.workspace_name ?? "Personal Jarvis"}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Lokaler Arbeitsbereich fuer deine Agents, Tools, Knowledge, Flows, Artefakte und Companion-Zugriffe.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:w-[560px]">
            {Object.entries(platform.counts).slice(0, 5).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{key.replaceAll("_", " ")}</div>
                <div className="text-lg font-semibold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-cyan-50">
                Solo-Modus: {soloStatus?.status ?? "bereit"} · {soloStatus?.ready_count ?? 0}/{soloStatus?.total_count ?? 0} Bereiche startklar
              </div>
              <div className="mt-1 text-xs text-cyan-100/75">
                Lokale Defaults, private Agents und persoenliche Gruppen sind aktiv. SSO/SCIM und entfernte Connectoren bleiben optional.
              </div>
            </div>
            <ActionButton
              icon={ShieldCheck}
              onClick={() => act("prepare_solo_workspace", { workspace_name: soloStatus?.workspace_name ?? "Personal Jarvis" })}
            >
              Solo vorbereiten
            </ActionButton>
            <ActionButton
              icon={Play}
              onClick={() =>
                act("run_solo_quickstart", {
                  workspace_name: soloStatus?.workspace_name ?? "Personal Jarvis",
                  agent_id: platform.agents[0]?.id ?? "research-copilot",
                  query: knowledgeQuery,
                  files: ingestFiles.split(",").map((item) => item.trim()).filter(Boolean),
                })
              }
            >
              Quickstart ausfuehren
            </ActionButton>
            <ActionButton icon={TestTubeDiagonal} onClick={() => act("run_solo_audit", {})}>
              Audit pruefen
            </ActionButton>
          </div>
          {soloStatus?.checklist && (
            <div className="mt-3 flex flex-wrap gap-2">
              {soloStatus.checklist.map((item) => (
                <span key={item.id} className="rounded-md border border-white/10 bg-[#03111a]/70 px-2 py-1 text-[11px] text-cyan-50">
                  {item.label}: {item.status}
                </span>
              ))}
            </div>
          )}
          {quickstartResult && (
            <div className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-[#03111a]/80 p-3 text-xs text-slate-300 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-white">{quickstartSummary?.title ?? "Solo Quickstart Ergebnis"}</div>
                  <StatusPill value={String(quickstartResult.status ?? "ready")} />
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-200">
                  {quickstartSummary?.agent_output || "Agent, Knowledge, Ingestion, Sandbox, Flow und Publishing wurden lokal angestossen."}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-md bg-white/5 px-3 py-2">
                    <div className="text-slate-500">Knowledge</div>
                    <div className="text-sm font-semibold text-white">{quickstartSummary?.knowledge_results ?? 0}</div>
                  </div>
                  <div className="rounded-md bg-white/5 px-3 py-2">
                    <div className="text-slate-500">Dokumente</div>
                    <div className="text-sm font-semibold text-white">{quickstartSummary?.ingested_documents ?? 0}</div>
                  </div>
                  <div className="rounded-md bg-white/5 px-3 py-2">
                    <div className="text-slate-500">Flow</div>
                    <div className="text-sm font-semibold text-white">{quickstartSummary?.workflow_status ?? "ready"}</div>
                  </div>
                  <div className="rounded-md bg-white/5 px-3 py-2">
                    <div className="text-slate-500">Report</div>
                    <div className="truncate text-sm font-semibold text-white">{quickstartSummary?.artifact_id ?? "artifact"}</div>
                  </div>
                </div>
                {quickstartSummary?.sandbox_stdout && (
                  <pre className="mt-3 max-h-24 overflow-auto rounded-md bg-black/20 p-2 text-[11px] text-slate-300">
                    {quickstartSummary.sandbox_stdout}
                  </pre>
                )}
              </div>
              <div className="grid gap-2">
                {Object.entries((quickstartResult.links as Record<string, string> | undefined) ?? {}).map(([label, url]) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-cyan-50 hover:bg-cyan-300/15">
                    {label}: {url}
                  </a>
                ))}
                {quickstartActions.map((action) => (
                  <button
                    key={`${action.kind}-${action.label}`}
                    onClick={() => {
                      if (action.kind === "tab" && action.target) setActiveTab(action.target as StudioTab);
                      if (action.kind === "artifact") setActiveTab("workspace");
                      if (action.kind === "sandbox") setActiveTab("workspace");
                    }}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-slate-100 hover:bg-white/10"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(platform.solo_quickstarts?.length ?? 0) > 0 && (
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {platform.solo_quickstarts?.slice(0, 3).map((run) => (
                <div key={run.id} className="rounded-lg border border-white/10 bg-[#03111a]/70 p-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-white">{run.summary?.title ?? run.id}</span>
                    <StatusPill value={run.status} />
                  </div>
                  <div className="mt-1 truncate text-slate-500">{run.artifact_id} · {run.created_at}</div>
                </div>
              ))}
            </div>
          )}
          {activeSoloAudit && (
            <div className="mt-3 rounded-lg border border-white/10 bg-[#03111a]/80 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Solo Audit</div>
                  <div className="text-xs text-slate-400">
                    {activeSoloAudit.ready_count ?? 0} bereit · {activeSoloAudit.optional_count ?? 0} optional · {activeSoloAudit.blocking_count ?? 0} offen
                  </div>
                </div>
                <StatusPill value={String(activeSoloAudit.status ?? "ready")} />
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {(activeSoloAudit.items ?? []).slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-100">{item.label}</span>
                      <StatusPill value={item.status} />
                    </div>
                    <div className="mt-1 truncate text-slate-500">{item.evidence.slice(0, 2).join(" · ") || item.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition ${
                activeTab === tab.id
                  ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-50"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-2 text-sm text-emerald-100">
          {notice}
        </div>
      )}
      {errorNotice && (
        <div className="border-b border-rose-300/20 bg-rose-300/10 px-5 py-2 text-sm text-rose-100">
          {errorNotice}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {activeTab === "agents" && (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Panel title="Agent/Persona Builder" icon={BrainCircuit}>
              <div className="space-y-3">
                <Field label="Name" value={agentDraft?.name ?? ""} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, name: value })} />
                <Field label="Modellprofil" value={agentDraft?.model ?? ""} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, model: value })} />
                <Field label="Version" value={agentDraft?.version ?? "1.0.0"} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, version: value })} />
                <Field label="System Prompt" multiline value={agentDraft?.prompt ?? ""} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, prompt: value })} />
                <Field label="Tools, kommagetrennt" value={agentDraft?.tools.join(", ") ?? ""} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, tools: value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                <Field label="Knowledge, kommagetrennt" value={agentDraft?.knowledge.join(", ") ?? ""} onChange={(value) => setAgentDraft((prev) => prev && { ...prev, knowledge: value.split(",").map((item) => item.trim()).filter(Boolean) })} />
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Save} onClick={() => agentDraft && act("save_agent", agentDraft as unknown as Record<string, unknown>)}>Agent speichern</ActionButton>
                  <ActionButton icon={PackagePlus} onClick={() => agentDraft && act("export_agent_package", { agent_id: agentDraft.id })}>Paket exportieren</ActionButton>
                  <ActionButton
                    icon={PackagePlus}
                    onClick={() =>
                      agentDraft &&
                      act("import_agent_package", {
                        package: {
                          format: "jarvis-agent-package/v1",
                          manifest: {
                            agent_id: agentDraft.id,
                            name: agentDraft.name,
                            model: agentDraft.model,
                            prompt: agentDraft.prompt,
                            tools: agentDraft.tools,
                            knowledge: agentDraft.knowledge,
                            parameters: agentDraft.parameters,
                            version: agentDraft.version ?? "1.0.0",
                          },
                        },
                      })
                    }
                  >
                    Paket importieren
                  </ActionButton>
                </div>
              </div>
            </Panel>
            <Panel title="Geteilte Agents" icon={Network}>
              <div className="grid gap-3 lg:grid-cols-2">
                {platform.agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => setAgentDraft(agent)}
                    className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-4 text-left transition hover:border-cyan-300/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold text-white">{agent.name}</h3>
                      <StatusPill value={agent.visibility} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">v{agent.version ?? "1.0.0"} · {agent.model}</div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-300">{agent.prompt}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-cyan-100">
                      {agent.tools.map((tool) => <span key={tool} className="rounded-md bg-cyan-300/10 px-2 py-1">{tool}</span>)}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agent Packages</div>
                {(platform.agent_packages ?? []).slice(0, 4).map((pkg) => (
                  <div key={pkg.id} className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{pkg.name}</span>
                      <StatusPill value={pkg.version} />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{pkg.tool_count} Tools · {pkg.knowledge_count} Knowledge · {pkg.artifact_path}</div>
                  </div>
                ))}
                {(platform.agent_packages ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">Noch keine Agent-Pakete exportiert.</div>
                )}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "access" && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title="Benutzer"
              icon={UsersRound}
              action={
                <ActionButton
                  icon={Save}
                  onClick={() =>
                    act("save_user", {
                      name: userDraft.name,
                      email: userDraft.email,
                      roles: userDraft.roles,
                      groups: userDraft.groups,
                    })
                  }
                >
                  Speichern
                </ActionButton>
              }
            >
              <div className="space-y-2">
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <div className="grid gap-2">
                    <Field label="Name" value={userDraft.name} onChange={(value) => setUserDraft((prev) => ({ ...prev, name: value }))} />
                    <Field label="E-Mail" value={userDraft.email} onChange={(value) => setUserDraft((prev) => ({ ...prev, email: value }))} />
                    <Field label="Rollen" value={userDraft.roles} onChange={(value) => setUserDraft((prev) => ({ ...prev, roles: value }))} />
                    <Field label="Gruppen" value={userDraft.groups} onChange={(value) => setUserDraft((prev) => ({ ...prev, groups: value }))} />
                  </div>
                </div>
                {platform.users.map((user) => (
                  <div key={user.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">{user.roles.map((role) => <StatusPill key={role} value={role} />)}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Gruppen" icon={Network}>
              <div className="space-y-2">
                {platform.groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                    <span className="text-sm text-white">{group.name}</span>
                    <span className="text-xs text-slate-400">{group.members.length} Mitglieder</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Rollen & ACLs"
              icon={ShieldCheck}
              action={
                <div className="flex gap-2">
                  <ActionButton
                    icon={Save}
                    onClick={() => act("save_role", { id: roleDraft.id, permissions: roleDraft.permissions })}
                  >
                    Rolle
                  </ActionButton>
                  <ActionButton
                    icon={Share2}
                    onClick={() =>
                      act("share_agent", {
                        agent_id: platform.agents[0]?.id ?? "research-copilot",
                        subjects: [{ type: "group", id: "research", access: "read" }],
                      })
                    }
                  >
                    Teilen
                  </ActionButton>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <Field label="Rollen-ID" value={roleDraft.id} onChange={(value) => setRoleDraft((prev) => ({ ...prev, id: value }))} />
                  <div className="mt-2">
                    <Field label="Permissions" value={roleDraft.permissions} onChange={(value) => setRoleDraft((prev) => ({ ...prev, permissions: value }))} />
                  </div>
                </div>
                {platform.roles.map((role) => (
                  <div key={role.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-medium text-white">{role.id}</div>
                    <div className="mt-2 text-xs text-slate-300">{role.permissions.join(", ")}</div>
                  </div>
                ))}
                <div className="text-xs text-slate-400">{platform.acls.length} ACL-Regeln fuer geteilte Ressourcen aktiv.</div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit Trail</div>
                  {(platform.audit_events ?? []).slice(0, 6).map((event) => (
                    <div key={event.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-white">{event.action}</div>
                        <StatusPill value={event.status} />
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {event.user} · {event.permission} · {event.resource}
                      </div>
                      {event.error && <div className="mt-1 text-xs text-rose-300">{event.error}</div>}
                    </div>
                  ))}
                  {(platform.audit_events ?? []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">
                      Noch keine Audit-Events.
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "extensions" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Plugin-/Skill-Marketplace"
              icon={PackagePlus}
              action={<ActionButton icon={RefreshCcw} onClick={() => act("sync_marketplace_registry", {})}>Registry</ActionButton>}
            >
              {platform.marketplace_policy && (
                <div className="mb-3 grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs text-slate-300 md:grid-cols-4">
                  <div>
                    <div className="text-slate-500">Max Risk</div>
                    <div className="font-medium text-white">{platform.marketplace_policy.max_risk ?? "medium"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Signatur</div>
                    <div className="font-medium text-white">{platform.marketplace_policy.require_signature ? "Pflicht" : "Optional"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Trust</div>
                    <div className="truncate font-medium text-white">{platform.marketplace_policy.allowed_trust?.join(", ") ?? "verified, community"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Audit</div>
                    <div className="font-medium text-white">{platform.marketplace_audit?.length ?? 0} Events</div>
                  </div>
                </div>
              )}
              <div className="grid gap-3 lg:grid-cols-3">
                {platform.marketplace.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">{item.kind} · {item.version} · {item.trust}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusPill value={item.installed ? (item.enabled ? "enabled" : "disabled") : "available"} />
                        <StatusPill value={item.review_status ?? "pending"} />
                        {item.risk && <StatusPill value={`risk:${item.risk.level}`} />}
                      </div>
                    </div>
                    <p className="mt-3 min-h-10 text-sm text-slate-300">{item.description}</p>
                    <div className="mt-3 grid gap-1 text-[11px] text-slate-500">
                      <span>Publisher: {item.publisher ?? "community"}</span>
                      <span>Latest: {item.latest_version ?? item.version}</span>
                      <span className="truncate">Permissions: {(item.permissions ?? ["tools:execute"]).join(", ")}</span>
                      <span className="truncate">Checksum: {item.checksum ?? "n/a"}</span>
                      <span className="truncate">Signatur: {item.signature ?? "unsigned"}</span>
                      <span className="truncate">Quelle: {item.source_url ?? "registry"}</span>
                    </div>
                    {item.risk && (
                      <div className="mt-3 rounded-md bg-[#03111a] px-2 py-2 text-[11px] text-slate-400">
                        <div className="flex items-center justify-between gap-2">
                          <span>Risk Score {item.risk.score}</span>
                          <StatusPill value={item.risk.level} />
                        </div>
                        <div className="mt-1 truncate">{item.risk.reasons?.join(", ")}</div>
                      </div>
                    )}
                    {item.verification && (
                      <div className="mt-3 rounded-md bg-[#03111a] px-2 py-2 text-[11px] text-slate-400">
                        <div className="flex items-center justify-between gap-2">
                          <span>Verification</span>
                          <StatusPill value={item.verification.status} />
                        </div>
                        <div className="mt-1 grid gap-1">
                          {(item.verification.checks ?? []).slice(0, 4).map((check) => (
                            <span key={check.name} className="truncate">{check.name}: {check.status}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.artifact_path && (
                      <p className="mt-2 truncate rounded-md bg-[#03111a] px-2 py-1 font-mono text-[11px] text-slate-400">
                        {item.artifact_path}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => act("review_marketplace_item", { id: item.id, verdict: "approved" })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Review
                      </button>
                      <button
                        onClick={() => act("verify_marketplace_item", { id: item.id, signature: `jarvis:${item.id}` })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => act("install_marketplace_item", { id: item.id })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        <PackagePlus className="h-4 w-4" />
                        Install
                      </button>
                      <button
                        onClick={() => act("set_marketplace_item_enabled", { id: item.id, enabled: !item.enabled })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        {item.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => act("update_marketplace_item", { id: item.id })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Update
                      </button>
                      <button
                        onClick={() => act("uninstall_marketplace_item", { id: item.id })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 text-xs text-rose-100 hover:bg-rose-300/15"
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Deferred MCP Discovery" icon={Globe2}>
              <div className="space-y-3">
                <Field label="Suchbegriff" value={mcpQuery} onChange={setMcpQuery} />
                <ActionButton icon={RefreshCcw} onClick={() => act("discover_mcp_tools", { query: mcpQuery })}>Tools suchen/laden</ActionButton>
                <div className="space-y-2">
                  {platform.mcp.tools.map((tool) => (
                    <div key={tool.name} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-white">{tool.name}</div>
                        <StatusPill value={tool.loaded ? "loaded" : "deferred"} />
                      </div>
                      <div className="text-xs text-slate-400">{tool.description}</div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => act("load_mcp_tool", { name: tool.name })} className="h-7 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10">
                          Laden
                        </button>
                        <button onClick={() => act("unload_mcp_tool", { name: tool.name })} className="h-7 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10">
                          Entladen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "tools" && (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Panel title="In-App Tool/Function Editor" icon={Code2}>
              <div className="space-y-3">
                <Field label="Tool Name" value={toolDraft?.name ?? ""} onChange={(value) => setToolDraft((prev) => prev && { ...prev, name: value })} />
                <div>
                  <div className="mb-2 text-xs font-medium text-slate-300">Tool-Art</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {["function", "filter", "pipe", "action", "openapi"].map((kind) => (
                      <button
                        key={kind}
                        onClick={() => setToolDraft((prev) => prev && { ...prev, kind })}
                        className={`h-9 rounded-lg border px-2 text-xs font-medium transition ${
                          toolDraft?.kind === kind
                            ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {kind}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Code / Pipe / Action" multiline value={toolDraft?.code ?? ""} onChange={(value) => setToolDraft((prev) => prev && { ...prev, code: value })} />
                <Field
                  label="Testparameter JSON"
                  multiline
                  value={JSON.stringify(toolDraft?.test_parameters ?? {}, null, 2)}
                  onChange={(value) =>
                    setToolDraft((prev) => {
                      if (!prev) return prev;
                      try {
                        return { ...prev, test_parameters: JSON.parse(value) };
                      } catch {
                        return prev;
                      }
                    })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Save} onClick={() => toolDraft && act("save_tool", toolDraft as unknown as Record<string, unknown>)}>Speichern</ActionButton>
                  <ActionButton icon={TestTubeDiagonal} onClick={() => toolDraft && act("test_tool", { id: toolDraft.id, parameters: toolDraft.test_parameters ?? {} })}>Testen</ActionButton>
                  {toolDraft?.kind === "openapi" && (
                    <ActionButton icon={Play} onClick={() => toolDraft && act("execute_openapi_tool", { id: toolDraft.id, parameters: {} })}>Plan</ActionButton>
                  )}
                </div>
                {toolDraft?.last_test && (
                  <pre className="max-h-36 overflow-auto rounded-lg bg-[#03111a] p-3 text-xs text-slate-300">
                    {JSON.stringify(toolDraft.last_test, null, 2)}
                  </pre>
                )}
                {toolDraft?.last_request_plan && (
                  <pre className="max-h-40 overflow-auto rounded-lg bg-[#03111a] p-3 text-xs text-slate-300">
                    {JSON.stringify(toolDraft.last_request_plan, null, 2)}
                  </pre>
                )}
              </div>
            </Panel>
            <div className="grid gap-4">
              <Panel title="Native OpenAPI Tool Import" icon={LibraryBig} action={<ActionButton icon={PackagePlus} onClick={() => act("import_openapi", { spec: openApiSpec })}>Importieren</ActionButton>}>
                <textarea
                  value={openApiSpec}
                  onChange={(event) => setOpenApiSpec(event.target.value)}
                  className="h-48 w-full rounded-lg border border-white/10 bg-[#03111a] p-3 font-mono text-xs text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </Panel>
              <Panel title="Tool Registry" icon={Braces}>
                <div className="grid gap-2 lg:grid-cols-2">
                  {platform.tools.map((tool) => (
                    <button key={tool.id} onClick={() => setToolDraft(tool)} className="rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:border-cyan-300/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">{tool.name}</span>
                        <StatusPill value={tool.status} />
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{tool.kind}{tool.method ? ` · ${tool.method} ${tool.path}` : ""}</div>
                      <div className="mt-2 text-xs text-slate-300">{tool.test_result}</div>
                      {tool.server_url && <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{tool.server_url}</div>}
                    </button>
                  ))}
                </div>
              </Panel>
              {(platform.tool_executions ?? []).length > 0 && (
                <Panel title="OpenAPI Execution Plans" icon={Play}>
                  <div className="space-y-2">
                    {(platform.tool_executions ?? []).slice(0, 3).map((execution) => (
                      <div key={execution.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-white">{execution.request.method}</span>
                          <StatusPill value={execution.status} />
                        </div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{execution.request.url}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )}

        {activeTab === "workflows" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Panel title="Visueller Workflow Builder" icon={GitBranch}>
              <div className="mb-4 rounded-lg border border-white/10 bg-[#03111a] p-3">
                <div className="grid gap-2 md:grid-cols-5">
                  <Field label="Node Label" value={workflowNodeDraft.label} onChange={(value) => setWorkflowNodeDraft((prev) => ({ ...prev, label: value }))} />
                  <Field label="Node Typ" value={workflowNodeDraft.type} onChange={(value) => setWorkflowNodeDraft((prev) => ({ ...prev, type: value }))} />
                  <Field label="Von" value={workflowNodeDraft.source} onChange={(value) => setWorkflowNodeDraft((prev) => ({ ...prev, source: value }))} />
                  <Field label="Nach" value={workflowNodeDraft.target} onChange={(value) => setWorkflowNodeDraft((prev) => ({ ...prev, target: value }))} />
                  <Field label="Route" value={workflowNodeDraft.edgeLabel} onChange={(value) => setWorkflowNodeDraft((prev) => ({ ...prev, edgeLabel: value }))} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    icon={Save}
                    onClick={() => act("edit_workflow_node", {
                      workflow_id: platform.workflows[0]?.id,
                      node_id: workflowNodeDraft.label.toLowerCase().replace(/\s+/g, "-"),
                      label: workflowNodeDraft.label,
                      type: workflowNodeDraft.type,
                      x: 58,
                      y: 78,
                    })}
                  >
                    Node
                  </ActionButton>
                  <ActionButton
                    icon={GitBranch}
                    onClick={() => act("connect_workflow_nodes", {
                      workflow_id: platform.workflows[0]?.id,
                      source: workflowNodeDraft.source,
                      target: workflowNodeDraft.target,
                      label: workflowNodeDraft.edgeLabel,
                    })}
                  >
                    Edge
                  </ActionButton>
                  <ActionButton icon={RefreshCcw} onClick={() => act("version_workflow", { workflow_id: platform.workflows[0]?.id, reason: "manual-ui" })}>
                    Version
                  </ActionButton>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {platform.workflows.map((workflow) => (
                  <WorkflowCanvas key={workflow.id} workflow={workflow} onRun={() => act("run_workflow", { workflow_id: workflow.id })} />
                ))}
              </div>
            </Panel>
            <Panel title="Run Replay & Debugger" icon={Bug}>
              <div className="space-y-3">
                {platform.runs.slice(0, 3).map((run) => (
                  <div key={run.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{run.id}</span>
                      <div className="flex items-center gap-2">
                        {run.status === "waiting_for_human" && (
                          <button
                            onClick={() => act("resume_workflow_run", { run_id: run.id, decision: "approved", comment: "Approved in Studio" })}
                            className="inline-flex h-7 items-center rounded-md bg-amber-300/15 px-2 text-[11px] text-amber-100 hover:bg-amber-300/20"
                          >
                            Approve
                          </button>
                        )}
                        <StatusPill value={run.status} />
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 rounded-md bg-[#03111a] p-2 text-[11px] text-slate-400 md:grid-cols-3">
                      <span>Steps {run.steps.length}</span>
                      <span>Events {run.timeline?.length ?? run.debug?.timeline_events ?? 0}</span>
                      <span>Human {run.debug?.human_decision ?? "n/a"}</span>
                    </div>
                    {(run.timeline?.length ?? 0) > 0 && (
                      <div className="mt-3 rounded-md border border-cyan-300/10 bg-[#03111a] p-2">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Replay Timeline</div>
                        <div className="max-h-72 space-y-2 overflow-auto pr-1">
                          {run.timeline?.slice(0, 14).map((event) => (
                            <div key={event.id} className="grid gap-2 rounded-md bg-white/5 p-2 text-[11px] text-slate-300">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium text-cyan-100">{event.index}. {event.type} · {event.node ?? "run"}</span>
                                <StatusPill value={event.status} />
                              </div>
                              <div className="truncate text-slate-400">{event.message}</div>
                              {event.payload && (
                                <pre className="max-h-20 overflow-hidden whitespace-pre-wrap rounded bg-black/20 p-2 font-mono text-[10px] text-slate-500">
                                  {JSON.stringify(event.payload, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {run.steps.map((step, index) => (
                        <div key={`${run.id}-${step.node}-${index}`} className="border-l border-cyan-300/30 pl-3">
                          <div className="text-xs font-medium text-cyan-100">{step.node} · {step.node_type ?? "step"} · {step.latency_ms}ms · retries {step.retries}</div>
                          <div className="text-xs text-slate-400">in: {step.input}</div>
                          <div className="text-xs text-slate-300">out: {step.output}</div>
                          {(step.tool_calls?.length ?? 0) > 0 && <div className="text-xs text-slate-400">tools: {step.tool_calls?.map((call) => typeof call === "string" ? call : String(call.name ?? "tool")).join(", ")}</div>}
                          {(step.route_labels?.length ?? 0) > 0 && <div className="text-xs text-slate-400">routes: {step.route_labels?.join(", ")}</div>}
                          {step.branch_taken && <div className="text-xs text-slate-400">branch: {step.branch_taken}</div>}
                          {step.selected_route && <div className="text-xs text-slate-400">selected route: {step.selected_route}</div>}
                          {(step.loop_iteration ?? 0) > 0 && <div className="text-xs text-slate-400">loop iteration: {step.loop_iteration}</div>}
                          {step.human_required && <div className="text-xs text-amber-200">human approval required</div>}
                          {(step.retry_log?.length ?? 0) > 0 && <div className="text-xs text-slate-500">{step.retry_log?.join(" · ")}</div>}
                          {step.error && <div className="text-xs text-rose-200">{step.error}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "quality" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Evaluations / Model Arena" icon={TestTubeDiagonal}>
              <div className="space-y-3">
                {platform.evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{evaluation.name}</h3>
                        <p className="text-xs text-slate-400">{evaluation.dataset} · Score {(evaluation.last_score ?? 0).toFixed(2)} · Regressionen {evaluation.regressions}</p>
                        <p className="mt-1 text-xs text-slate-500">{evaluation.baseline ?? evaluation.agents[0]} vs {evaluation.challenger ?? evaluation.agents[1] ?? "variant"} · Gate {evaluation.regression_gate?.min_score ?? 0.8}/{evaluation.regression_gate?.max_regressions ?? 0}</p>
                      </div>
                      <ActionButton icon={Play} onClick={() => act("run_evaluation", { id: evaluation.id, baseline: evaluation.baseline, challenger: evaluation.challenger })}>A/B Run</ActionButton>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(evaluation.elo).map(([agent, elo]) => <StatusPill key={agent} value={`${agent}: ${elo}`} />)}
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Letzte Arena-Runs</div>
                  <div className="space-y-2">
                    {platform.evaluation_runs.slice(0, 4).map((run) => (
                      <div key={run.id} className="rounded-lg bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-medium text-white">{run.dataset}</span>
                          <StatusPill value={run.status} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">Score {run.score.toFixed(2)} · Cases {run.cases.length} · Regressionen {run.regressions}</div>
                        <div className="mt-1 text-[11px] text-slate-400">Winner {run.winner ?? "n/a"} · Gate {run.gate?.status ?? run.status}</div>
                        {run.elo_delta && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(run.elo_delta).map(([agent, delta]) => (
                              <span key={`${run.id}-${agent}`} className="rounded bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100">
                                {agent} {delta >= 0 ? "+" : ""}{delta}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 grid gap-1">
                          {(run.pairs ?? []).slice(0, 3).map((item) => (
                            <div key={`${run.id}-${item.case_id}-${item.winner}`} className="flex items-center justify-between rounded bg-black/15 px-2 py-1 text-[11px] text-slate-300">
                              <span>{item.case_id} · {item.baseline} vs {item.challenger}</span>
                              <span>{item.winner} +{item.margin.toFixed(2)}</span>
                            </div>
                          ))}
                          {run.cases.slice(0, 2).map((item) => (
                            <div key={`${run.id}-${item.case_id}-${item.agent}`} className="flex items-center justify-between rounded bg-black/15 px-2 py-1 text-[11px] text-slate-300">
                              <span>{item.case_id} · {item.agent}</span>
                              <span>{item.score.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
            <Panel
              title="Token-, Kosten- und Latenz-Dashboard"
              icon={ChartNoAxesCombined}
              action={
                <ActionButton
                  icon={RefreshCcw}
                  onClick={() => act("aggregate_metrics", { dimensions: ["model", "tool", "user", "agent", "workflow"] })}
                >
                  Aggregieren
                </ActionButton>
              }
            >
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/5 p-3"><div className="text-xs text-slate-400">Tokens</div><div className="text-lg font-semibold text-white">{totalTokens.toLocaleString()}</div></div>
                <div className="rounded-lg bg-white/5 p-3"><div className="text-xs text-slate-400">Kosten</div><div className="text-lg font-semibold text-white">${totalCost.toFixed(2)}</div></div>
                <div className="rounded-lg bg-white/5 p-3"><div className="text-xs text-slate-400">Scopes</div><div className="text-lg font-semibold text-white">{metricRows.length}</div></div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metricRows}>
                    <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                    <XAxis dataKey="scope" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#071823", border: "1px solid rgba(255,255,255,.12)", color: "#e2e8f0" }} />
                    <Bar dataKey="tokens" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {Object.entries(platform.metrics_aggregate ?? {}).slice(0, 5).map(([dimension, rows]) => (
                  <div key={dimension} className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">nach {dimension}</div>
                    <div className="space-y-1">
                      {rows.slice(0, 4).map((row) => (
                        <div key={`${dimension}-${row.key}`} className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                          <span className="truncate">{row.key}</span>
                          <span>{row.tokens.toLocaleString()} tok · {row.avg_latency_ms}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Knowledge Base Sync"
              icon={DatabaseZap}
              action={
                <div className="flex gap-2">
                  <ActionButton
                    icon={Save}
                    onClick={() => act("save_knowledge_source", knowledgeDraft)}
                  >
                    Quelle
                  </ActionButton>
                  <ActionButton
                    icon={RefreshCcw}
                    onClick={() => act("run_due_knowledge_syncs", { force: false })}
                  >
                    Due Run
                  </ActionButton>
                </div>
              }
            >
              <div className="mb-4 rounded-lg border border-white/10 bg-[#03111a] p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Quelle" value={knowledgeDraft.source} onChange={(value) => setKnowledgeDraft((prev) => ({ ...prev, source: value }))} />
                  <Field label="Ziel" value={knowledgeDraft.target} onChange={(value) => setKnowledgeDraft((prev) => ({ ...prev, target: value }))} />
                  <Field label="URI" value={knowledgeDraft.uri} onChange={(value) => setKnowledgeDraft((prev) => ({ ...prev, uri: value }))} />
                  <Field label="Vector DB" value={knowledgeDraft.vector_db} onChange={(value) => setKnowledgeDraft((prev) => ({ ...prev, vector_db: value }))} />
                  <Field label="Schedule" value={knowledgeDraft.schedule} onChange={(value) => setKnowledgeDraft((prev) => ({ ...prev, schedule: value }))} />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Field label="Hybrid Search" value={knowledgeQuery} onChange={setKnowledgeQuery} />
                  <div className="flex items-end">
                    <ActionButton icon={DatabaseZap} onClick={() => act("search_knowledge", { query: knowledgeQuery, top_k: 5 })}>Suchen</ActionButton>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {platform.knowledge.map((source) => (
                  <div key={source.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{source.target}</h3>
                      <StatusPill value={source.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{source.source} · {source.rag}</p>
                    <p className="mt-1 text-xs text-slate-400">Vector DB: {source.vector_db} · {source.schedule ?? "manual"}</p>
                    <p className="mt-1 text-xs text-slate-400">Next: {source.next_sync || "manual"} · Watch: {String(source.watch_mode ?? false)} · {source.connector_status ?? "ready"}</p>
                    {source.uri && <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{source.uri}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => act("sync_knowledge", { id: source.id })} className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10">
                        <RefreshCcw className="h-4 w-4" />
                        Sync
                      </button>
                      <button onClick={() => act("schedule_knowledge_sync", { id: source.id, schedule: source.schedule ?? "hourly" })} className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10">
                        Planen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Dokument-Extraktion"
              icon={FileCode2}
              action={
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    icon={Play}
                    onClick={() => act("ingest_documents", { files: ingestFiles, engine: "Docling" })}
                  >
                    Batch
                  </ActionButton>
                  <ActionButton
                    icon={CloudCog}
                    onClick={() => act("configure_extraction", { engine: "Docling", tables: true, layout: true, ocr: true, batch_size: 50 })}
                  >
                    Engine
                  </ActionButton>
                </div>
              }
            >
              <div className="space-y-3 text-sm text-slate-300">
                <Field label="Batch-Dateien" value={ingestFiles} onChange={setIngestFiles} />
                <div>Engines: {platform.extraction.engines?.join(", ")}</div>
                <div>Tabellen: {String(platform.extraction.tables)}</div>
                <div>Scans/OCR: {String(platform.extraction.scans)}</div>
                <div>Layouts: {String(platform.extraction.layouts)}</div>
                <div>Artefakte: {platform.extraction.artifact_dir}</div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-slate-400">
                  Docling Config: {JSON.stringify(platform.extraction.engine_config?.Docling ?? {}, null, 0)}
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Batch Queue</div>
                  <div className="space-y-2">
                    {(platform.extraction.batch_queue ?? []).slice(-4).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        <span className="truncate">{item.name} · {item.engine}</span>
                        <StatusPill value={item.status} />
                      </div>
                    ))}
                    {(platform.extraction.batch_queue ?? []).length === 0 && <div className="rounded-lg border border-dashed border-white/10 p-2 text-xs text-slate-500">Keine Queue-Eintraege.</div>}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Letzte Ingestion-Runs</div>
                  <div className="space-y-2">
                    {(platform.extraction.runs ?? []).slice(0, 3).map((run) => (
                      <div key={run.id} className="rounded-lg bg-white/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-white">{run.engine} · {run.batch_size} Dateien</span>
                          <StatusPill value={run.status} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{run.artifact_dir}</div>
                        {run.artifact_id && <div className="mt-1 text-[11px] text-cyan-200">Report: {run.artifact_id}</div>}
                        {run.diagnostics && (
                          <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                            <span>Review {run.diagnostics.documents_review}/{run.diagnostics.documents_total}</span>
                            <span>RAG {String(run.diagnostics.rag_ready)}</span>
                            <span>Tables {run.diagnostics.tables_total}</span>
                            <span>OCR Spans {run.diagnostics.ocr_spans_total}</span>
                          </div>
                        )}
                        <div className="mt-2 space-y-1">
                          {run.documents.slice(0, 2).map((doc) => (
                            <div key={`${run.id}-${doc.id}`} className="rounded bg-black/15 px-2 py-1 text-[11px] text-slate-300">
                              <div>{doc.name} · {doc.pages} Seiten · {doc.tables} Tabellen · OCR {String(doc.ocr)} · {Math.round((doc.ocr_confidence ?? 0) * 100)}% · {doc.quality ?? "ready"}</div>
                              <div className="text-slate-500">Layout {doc.layout_blocks ?? 0} · OCR Spans {doc.ocr_spans ?? 0} · RAG {String(doc.rag_ready ?? false)}</div>
                              {(doc.quality_gates?.length ?? 0) > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {doc.quality_gates?.slice(0, 4).map((gate) => (
                                    <span key={`${doc.id}-${gate.name}`} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                                      {gate.name}:{gate.status}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Scheduler-Runs</div>
                  <div className="mb-3 space-y-2">
                    {(platform.knowledge_scheduler_runs ?? []).slice(0, 3).map((run) => (
                      <div key={run.id} className="rounded-lg bg-white/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-white">{run.synced_sources}/{run.checked_sources} Quellen synchronisiert</span>
                          <StatusPill value={run.status} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{run.runs.join(", ") || "Keine faelligen Runs"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Letzte Sync-Runs</div>
                  <div className="space-y-2">
                    {platform.knowledge_runs.slice(0, 4).map((run) => (
                      <div key={run.id} className="rounded-lg bg-white/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-white">{run.target}</span>
                          <StatusPill value={run.status} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{run.phases.length} Phasen · {run.vector_db}</div>
                        {run.index && <div className="mt-1 text-[11px] text-slate-500">{run.documents ?? 0} Docs · {run.chunks ?? 0} Chunks · {run.index.bm25_terms} BM25 · {run.index.vectors} Vectors</div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Hybrid Search</div>
                  <div className="space-y-2">
                    {(platform.knowledge_searches ?? []).slice(0, 3).map((search) => (
                      <div key={search.id} className="rounded-lg bg-white/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-white">{search.query}</span>
                          <StatusPill value={search.status} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{search.retrieval} · {search.results.length} Treffer</div>
                        {search.results.slice(0, 2).map((result) => (
                          <div key={`${search.id}-${result.chunk_id}`} className="mt-2 rounded bg-black/15 px-2 py-1 text-[11px] text-slate-300">
                            <div className="truncate">{result.text}</div>
                            <div className="text-slate-500">BM25 {result.bm25_score.toFixed(2)} · Vector {result.vector_score.toFixed(2)} · Rerank {result.rerank_score.toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "workspace" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Notes/Artifacts Workspace" icon={FileCode2} action={<ActionButton icon={Save} onClick={() => act("create_artifact", { title: "New Studio Note", kind: "note", content: "Persistent Jarvis note" })}>Neue Notiz</ActionButton>}>
              <div className="grid gap-3 lg:grid-cols-2">
                {platform.artifacts.map((artifact) => (
                  <div key={artifact.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="truncate text-sm font-semibold text-white">{artifact.title}</h3>
                      <StatusPill value={artifact.kind} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span>v{artifact.version ?? 1}</span>
                      <span>{artifact.render_status ?? "ready"}</span>
                      <span>{artifact.versions?.length ?? 1} Versionen</span>
                    </div>
                    <pre className="mt-3 max-h-28 overflow-hidden whitespace-pre-wrap rounded-lg bg-[#03111a] p-3 text-xs text-slate-300">{artifact.content}</pre>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => act("version_artifact", { id: artifact.id, content: `${artifact.content}\n\nUpdated ${new Date().toISOString()}` })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        Version
                      </button>
                      <button
                        onClick={() => act("render_artifact", { id: artifact.id })}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                      >
                        Render
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Code Interpreter Sandbox" icon={Code2} action={<ActionButton icon={Play} onClick={() => act("run_sandbox", { language: sandboxLanguage, code: sandboxCode })}>Run</ActionButton>}>
              <div className="mb-3 grid gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs text-slate-300 md:grid-cols-3">
                <div>
                  <div className="text-slate-500">Network</div>
                  <div className="font-medium text-white">{String(platform.sandbox.policy?.network ?? "disabled")}</div>
                </div>
                <div>
                  <div className="text-slate-500">Filesystem</div>
                  <div className="font-medium text-white">{String(platform.sandbox.policy?.filesystem ?? "uploads-only")}</div>
                </div>
                <div>
                  <div className="text-slate-500">Audit</div>
                  <div className="font-medium text-white">{platform.sandbox.audit?.length ?? 0} Runs</div>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["python", "javascript"] as const).map((language) => (
                  <button
                    key={language}
                    onClick={() => {
                      setSandboxLanguage(language);
                      setSandboxCode(language === "python" ? "print('Jarvis sandbox ready')\nprint(2 + 2)" : "console.log('Jarvis JS sandbox ready');\nreturn { answer: 42, at: sandbox.now() };");
                    }}
                    className={`h-8 rounded-lg border px-3 text-xs font-medium ${
                      sandboxLanguage === language
                        ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {language === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              <textarea value={sandboxCode} onChange={(event) => setSandboxCode(event.target.value)} className="h-44 w-full rounded-lg border border-white/10 bg-[#03111a] p-3 font-mono text-xs text-slate-100 outline-none focus:border-cyan-300/40" />
              <div className="mt-3 space-y-2">
                {platform.sandbox.runs.slice(0, 3).map((run) => (
                  <div key={run.id} className="rounded-lg bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white">{run.language} · {run.id}</span>
                      <StatusPill value={run.status} />
                    </div>
                    {run.limits && (
                      <div className="mb-2 grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                        <span>Timeout {String(run.limits.timeout_seconds)}s</span>
                        <span>Output {String(run.limits.max_output_chars)}</span>
                        <span>Uploads {String(run.limits.max_upload_files)}</span>
                        <span>Bytes {String(run.limits.max_upload_bytes)}</span>
                      </div>
                    )}
                    <pre className="max-h-28 overflow-auto text-xs text-slate-300">{String(run.stdout || run.stderr || run.status)}</pre>
                    {(run.uploaded_files?.length ?? 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {run.uploaded_files?.map((file) => (
                          <span key={`${run.id}-${file.name}`} className="rounded bg-[#03111a] px-2 py-1 text-[11px] text-slate-400">
                            {file.name} {file.truncated ? "truncated" : `${file.size ?? 0}b`}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(run.artifacts ?? []).map((artifact) => (
                        <span key={`${run.id}-${artifact.path}`} className="rounded-md bg-[#03111a] px-2 py-1 font-mono text-[11px] text-slate-400">
                          {artifact.kind}: {artifact.path}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "publish" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Web-App / Widget / API / MCP Publishing" icon={Rocket}>
              <div className="space-y-3">
                {platform.publishing.map((publication) => (
                  <div key={publication.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div>
                      <div className="text-sm font-medium text-white">{publication.kind}</div>
                      <div className="text-xs text-slate-400">{publication.url}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-400">
                        <span>{publication.policy?.auth ?? "workspace"}</span>
                        <span>{publication.policy?.rate_limit_per_minute ?? 60}/min</span>
                        <span>{publication.policy?.allowed_groups?.join(", ") ?? "core"}</span>
                        <span>{publication.policy?.api_key_count ?? publication.policy?.api_keys?.length ?? 0} Keys</span>
                      </div>
                      {(publication.policy?.api_keys?.length ?? 0) > 0 && (
                        <div className="mt-2 space-y-1">
                          {publication.policy?.api_keys?.slice(0, 2).map((key) => (
                            <div key={key.id} className="flex items-center justify-between gap-2 rounded-md bg-[#03111a] px-2 py-1 text-[11px] text-slate-400">
                              <span className="truncate">{key.name ?? key.id}</span>
                              <StatusPill value={key.status} />
                            </div>
                          ))}
                        </div>
                      )}
                      {publication.artifact_path && (
                        <div className="mt-1 font-mono text-[11px] text-slate-500">{publication.artifact_path}</div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => act("save_publish_policy", { id: publication.id, auth: "api-key", rate_limit_per_minute: 120, allowed_groups: ["core"], secret_refs: ["JARVIS_AGENT_TOKEN"] })}
                          className="inline-flex h-7 items-center gap-2 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10"
                        >
                          API-Key Policy
                        </button>
                        <button
                          onClick={() => act("issue_publish_api_key", { id: publication.id, name: "Studio Key" })}
                          className="inline-flex h-7 items-center gap-2 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10"
                        >
                          Key ausstellen
                        </button>
                      </div>
                    </div>
                    <StatusPill value={publication.status} />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Rocket} onClick={() => act("publish_agent", { agent_id: platform.agents[0]?.id, kind: "web-app", policy: { auth: "workspace", rate_limit_per_minute: 60, allowed_groups: ["core"] } })}>Web-App</ActionButton>
                  <ActionButton icon={Globe2} onClick={() => act("publish_agent", { agent_id: platform.agents[0]?.id, kind: "rest-api", policy: { auth: "api-key", rate_limit_per_minute: 120, secret_refs: ["JARVIS_AGENT_TOKEN"] } })}>REST API</ActionButton>
                  <ActionButton icon={Network} onClick={() => act("publish_agent", { agent_id: platform.agents[0]?.id, kind: "mcp-server", policy: { auth: "api-key", rate_limit_per_minute: 120, secret_refs: ["JARVIS_MCP_TOKEN"] } })}>MCP</ActionButton>
                </div>
              </div>
            </Panel>
            <Panel
              title="Produktions-Deployment"
              icon={CloudCog}
              action={
                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={RefreshCcw} onClick={() => act("check_deployment_readiness", { target: "production" })}>Readiness</ActionButton>
                  <ActionButton icon={DatabaseZap} onClick={() => act("check_database_migrations", {})}>Migrationen</ActionButton>
                </div>
              }
            >
              <KeyValue data={platform.deployment} />
              {Array.isArray((platform.deployment.migrations as { catalog?: unknown[] } | undefined)?.catalog) && (
                <div className="mt-4 space-y-2">
                  {((platform.deployment.migrations as { catalog: Array<{ id: string; status: string; checksum: string; tables?: string[] }> }).catalog).map((migration) => (
                    <div key={migration.id} className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-100">{migration.id}</span>
                        <StatusPill value={migration.status} />
                      </div>
                      <p className="mt-1 truncate text-slate-500">{migration.checksum.slice(0, 16)} · {(migration.tables ?? []).slice(0, 4).join(", ")}</p>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray((platform.deployment.readiness as { checks?: unknown[] } | undefined)?.checks) && (
                <div className="mt-4 space-y-2">
                  {((platform.deployment.readiness as { checks: Array<{ name: string; status: string; detail: string }> }).checks).map((check) => (
                    <div key={check.name} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                      <span className="truncate">{check.name} · {check.detail}</span>
                      <StatusPill value={check.status} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeTab === "enterprise" && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              title="SSO / OIDC / LDAP / SCIM"
              icon={KeyRound}
              action={
                <ActionButton
                  icon={Save}
                  onClick={() => act("save_identity_provider", identityDraft)}
                >
                  Provider
                </ActionButton>
              }
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <div className="grid gap-2">
                    <Field label="Name" value={identityDraft.name} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, name: value }))} />
                    <Field label="Typ" value={identityDraft.type} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, type: value }))} />
                    <Field label="Issuer" value={identityDraft.issuer} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, issuer: value }))} />
                    <Field label="Client ID" value={identityDraft.client_id} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, client_id: value }))} />
                    <Field label="Audience" value={identityDraft.audience} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, audience: value }))} />
                    <Field label="JWKS URI" value={identityDraft.jwks_uri} onChange={(value) => setIdentityDraft((prev) => ({ ...prev, jwks_uri: value }))} />
                  </div>
                </div>
                {platform.identity_providers.map((provider) => (
                  <div key={provider.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{provider.name}</span>
                      <StatusPill value={provider.status} />
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{provider.type} · {provider.issuer || provider.ldap_url || "local"}</div>
                    {provider.type === "oidc" && (
                      <div className="mt-1 text-xs text-slate-500">
                        Audience {provider.audience || provider.client_id || "-"} · JWKS {provider.jwks?.keys?.length ? `${provider.jwks.keys.length} keys` : provider.jwks_uri || "nicht geladen"}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => act("test_identity_provider", { id: provider.id })} className="inline-flex h-7 items-center gap-2 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10">
                        <TestTubeDiagonal className="h-3.5 w-3.5" />
                        Test
                      </button>
                      <button
                        onClick={() => act("start_sso_login", { provider_id: provider.id, redirect_uri: "/api/auth/callback" })}
                        className="inline-flex h-7 items-center gap-2 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10"
                      >
                        Login
                      </button>
                      <button
                        onClick={() => act("sync_identity_claims", {
                          provider_id: provider.id,
                          claims: { email: scimDraft.email, name: scimDraft.name, groups: scimDraft.groups.split(","), roles: scimDraft.roles.split(",") },
                        })}
                        className="inline-flex h-7 items-center gap-2 rounded-md bg-white/5 px-2 text-[11px] text-slate-100 hover:bg-white/10"
                      >
                        Claims
                      </button>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">SSO Runtime</div>
                      <div className="mt-1 text-xs text-slate-300">{ssoSessions.length} Sessions · {ssoEvents.length} Events</div>
                    </div>
                    <ActionButton
                      icon={KeyRound}
                      onClick={() => act("complete_sso_login", {
                        state: pendingSsoFlow?.state,
                        claims: { email: scimDraft.email, name: scimDraft.name, groups: scimDraft.groups.split(","), roles: scimDraft.roles.split(",") },
                      })}
                    >
                      Callback
                    </ActionButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {ssoSessions.slice(0, 3).map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-2 rounded-md bg-[#03111a] px-2 py-1 text-xs text-slate-300">
                        <span className="truncate">{session.email} · {session.provider_id}</span>
                        <StatusPill value={session.status} />
                      </div>
                    ))}
                    {ssoEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="flex items-center justify-between gap-2 rounded-md bg-[#03111a] px-2 py-1 text-xs text-slate-400">
                        <span className="truncate">{event.action} · {event.provider_id}</span>
                        <StatusPill value={event.status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
            <Panel title="Agent Chains / Subagents" icon={GitBranch}>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <Field label="Chain-Ziel" multiline value={chainGoal} onChange={setChainGoal} />
                  <div className="mt-3">
                    <ActionButton icon={Play} onClick={() => act("run_agent_chain", { agent_id: platform.agents[0]?.id, goal: chainGoal })}>
                      Chain starten
                    </ActionButton>
                  </div>
                </div>
                {platform.subagents.map((agent) => (
                  <div key={agent.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-medium text-white">{agent.name}</div>
                    <div className="text-xs text-slate-400">{agent.role} · {agent.status}</div>
                  </div>
                ))}
                <div className="space-y-2">
                  {platform.agent_chain_runs.slice(0, 3).map((run) => (
                    <div key={run.id} className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-white">{run.goal}</span>
                        <StatusPill value={run.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{run.compact_result}</p>
                      <div className="mt-2 text-[11px] text-slate-500">{run.steps.length} Subagent-Schritte</div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel
              title="SCIM & Companion"
              icon={Smartphone}
              action={
                <ActionButton
                  icon={UsersRound}
                  onClick={() => act("provision_scim_user", scimDraft)}
                >
                  SCIM
                </ActionButton>
              }
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-[#03111a] p-3">
                  <div className="grid gap-2">
                    <Field label="Name" value={scimDraft.name} onChange={(value) => setScimDraft((prev) => ({ ...prev, name: value }))} />
                    <Field label="E-Mail" value={scimDraft.email} onChange={(value) => setScimDraft((prev) => ({ ...prev, email: value }))} />
                    <Field label="Rollen" value={scimDraft.roles} onChange={(value) => setScimDraft((prev) => ({ ...prev, roles: value }))} />
                    <Field label="Gruppen" value={scimDraft.groups} onChange={(value) => setScimDraft((prev) => ({ ...prev, groups: value }))} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => act("deprovision_scim_user", { email: scimDraft.email })}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 text-xs text-rose-100 hover:bg-rose-300/15"
                    >
                      Deprovision
                    </button>
                    <button
                      onClick={() => act("list_workspace_files", { path: "." })}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Files
                    </button>
                    <button
                      onClick={() => act("create_companion_pairing", { device_name: "Mobile Companion" })}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Pair
                    </button>
                    <button
                      onClick={() => act("get_companion_workspace", { path: ".", session_id: companionSessionId })}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Mobile
                    </button>
                    <button
                      onClick={() => act("run_companion_terminal", { command: "git status", session_id: companionSessionId })}
                      className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-slate-100 hover:bg-white/10"
                    >
                      Terminal
                    </button>
                  </div>
                </div>
                <KeyValue data={platform.companion} />
                {companionSessions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Companion Sessions</div>
                    {companionSessions.slice(0, 3).map((session) => (
                      <div key={session.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 p-2 text-xs text-slate-300">
                        <span className="truncate">{session.device_name ?? session.id}</span>
                        <StatusPill value={session.status} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {platform.scim_events.slice(0, 3).map((event) => (
                    <div key={event.id} className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">
                      {event.action} · {event.email} · {event.status}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowCanvas({ workflow, onRun }: { workflow: PlatformWorkflow; onRun: () => void }) {
  const nodeById = new Map(workflow.nodes.map((node, index) => [
    node.id,
    { ...node, x: node.x ?? 12 + index * 18, y: node.y ?? 50 },
  ]));

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{workflow.name}</h3>
          <p className="text-xs text-slate-400">{workflow.edges.length} Kanten · {workflow.nodes.length} Nodes · v{workflow.version ?? 1} · Canvas Flow</p>
        </div>
        <ActionButton onClick={onRun} icon={Play}>Run</ActionButton>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(workflow.canvas?.supports ?? []).map((support) => <StatusPill key={support} value={support} />)}
      </div>
      {(workflow.versions?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
          {workflow.versions?.slice(0, 3).map((version) => (
            <span key={`${workflow.id}-v${version.version}`} className="rounded-md bg-white/5 px-2 py-1">
              v{version.version} {version.reason ? `· ${version.reason}` : ""}
            </span>
          ))}
        </div>
      )}
      <div className="relative mt-4 h-80 overflow-hidden rounded-lg border border-white/10 bg-[#03111a]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {workflow.edges.map((edge, index) => {
            const from = nodeById.get(edge[0]);
            const to = nodeById.get(edge[1]);
            if (!from || !to) return null;
            const midX = ((from.x ?? 0) + (to.x ?? 0)) / 2;
            return (
              <g key={`${edge.join("-")}-${index}`}>
                <path
                  d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                  fill="none"
                  stroke="rgba(34,211,238,.35)"
                  strokeWidth="0.6"
                  vectorEffect="non-scaling-stroke"
                />
                {edge[2] && (
                  <text x={midX} y={((from.y ?? 0) + (to.y ?? 0)) / 2 - 2} fill="#9fb4c7" fontSize="2.8" textAnchor="middle">
                    {edge[2]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {workflow.nodes.map((node) => (
          <div
            key={node.id}
            className="absolute min-h-[72px] w-32 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-cyan-300/30 bg-[#071823] p-3 shadow-xl shadow-black/20"
            style={{ left: `${node.x ?? 50}%`, top: `${node.y ?? 50}%` }}
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">{node.type}</div>
            <div className="mt-2 text-sm font-medium text-white">{node.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyValue({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-xs text-slate-400">{key.replaceAll("_", " ")}</span>
          <span className="max-w-[55%] truncate text-right text-xs font-medium text-slate-100">
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
