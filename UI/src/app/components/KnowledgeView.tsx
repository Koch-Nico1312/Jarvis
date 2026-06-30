import { useMemo, useState } from "react";
import {
  BookOpenText,
  BrainCircuit,
  DatabaseZap,
  FileSearch,
  GitBranch,
  Loader2,
  Network,
  PenLine,
  Save,
} from "lucide-react";
import { jarvisApi } from "../lib/api";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";

type KnowledgeResult = {
  title?: string;
  content?: string;
  source?: string;
  uri?: string;
  score?: number | null;
  metadata?: Record<string, unknown>;
};

type NoteSuggestion = {
  title?: string;
  summary?: string;
  sources?: string[];
  links?: string[];
  tags?: string[];
  confidence?: number;
  reason?: string;
  content?: string;
};

type GraphEdge = {
  source?: string;
  target?: string;
  relation?: string;
  evidence?: string;
};

const sourceOptions = [
  { id: "obsidian", label: "Obsidian" },
  { id: "documents", label: "Dokumente" },
  { id: "wikipedia", label: "Wikipedia" },
  { id: "memory", label: "Memory" },
];

function asResults(payload: Record<string, unknown>): KnowledgeResult[] {
  const direct = payload.results;
  if (Array.isArray(direct)) return direct as KnowledgeResult[];
  return [];
}

function asSuggestions(payload: Record<string, unknown>): NoteSuggestion[] {
  const direct = payload.suggestions;
  if (Array.isArray(direct)) return direct as NoteSuggestion[];
  return [];
}

function asEdges(payload: Record<string, unknown>): GraphEdge[] {
  const direct = payload.graph_edges;
  if (Array.isArray(direct)) return direct as GraphEdge[];
  return [];
}

export function KnowledgeView() {
  const [query, setQuery] = useState("container isolation");
  const [path, setPath] = useState("Documents");
  const [kind, setKind] = useState("directory");
  const [maxResults, setMaxResults] = useState("5");
  const [sources, setSources] = useState<string[]>(["obsidian", "documents"]);
  const [activeResult, setActiveResult] = useState<Record<string, unknown> | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => asResults(activeResult ?? {}), [activeResult]);
  const suggestions = useMemo(() => asSuggestions(activeResult ?? {}), [activeResult]);
  const edges = useMemo(() => asEdges(activeResult ?? {}), [activeResult]);
  const contextText = typeof activeResult?.text === "string" ? activeResult.text : "";
  const written = Array.isArray(activeResult?.written) ? (activeResult.written as string[]) : [];

  const runAction = async (action: string) => {
    setLoadingAction(action);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        action,
        query,
        max_results: Number(maxResults) || 5,
        sources,
      };
      if (action === "index") {
        payload.path = path;
        payload.kind = kind;
      }
      const response = await jarvisApi.knowledgeAction(payload);
      setActiveResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge-Aktion fehlgeschlagen.");
    } finally {
      setLoadingAction(null);
    }
  };

  const toggleSource = (source: string, checked: boolean) => {
    setSources((current) =>
      checked ? Array.from(new Set([...current, source])) : current.filter((item) => item !== source),
    );
  };

  return (
    <div className="flex h-full flex-col bg-[#071823]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-200/80">
              <BrainCircuit className="h-4 w-4" />
              Knowledge Manager
            </div>
            <h2 className="text-lg font-semibold text-white">Lokales Wissen</h2>
            <p className="text-sm text-slate-400">
              Suche, Kontext, Indexing, automatische Obsidian-Notizen und Graph.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => runAction("search")} className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {loadingAction === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              Suchen
            </Button>
            <Button type="button" onClick={() => runAction("context")} variant="outline" className="gap-2 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
              <BookOpenText className="h-4 w-4" />
              Kontext
            </Button>
            <Button type="button" onClick={() => runAction("suggest_notes")} variant="outline" className="gap-2 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
              <PenLine className="h-4 w-4" />
              Vorschlagen
            </Button>
            <Button type="button" onClick={() => runAction("write_notes")} variant="outline" className="gap-2 border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15">
              <Save className="h-4 w-4" />
              Schreiben
            </Button>
            <Button type="button" onClick={() => runAction("graph")} variant="outline" className="gap-2 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
              <Network className="h-4 w-4" />
              Graph
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[360px_1fr]">
        <section className="min-h-0 border-r border-white/10 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-white">Suchfrage</Label>
              <Textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-[110px] border-white/10 bg-black/20 text-white placeholder:text-slate-500"
                placeholder="Wonach soll Jarvis in deinem Wissen suchen?"
              />
            </div>

            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-white">Index-Pfad</Label>
                <Input value={path} onChange={(event) => setPath(event.target.value)} className="border-white/10 bg-black/20 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-white">Limit</Label>
                <Input value={maxResults} onChange={(event) => setMaxResults(event.target.value)} className="border-white/10 bg-black/20 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-white">Index-Art</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="directory">Ordner</SelectItem>
                  <SelectItem value="file">Datei</SelectItem>
                  <SelectItem value="obsidian">Obsidian Vault</SelectItem>
                  <SelectItem value="zim">Kiwix ZIM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-white">Quellen</Label>
              <div className="grid gap-2">
                {sourceOptions.map((source) => (
                  <label key={source.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <Checkbox
                      checked={sources.includes(source.id)}
                      onCheckedChange={(checked) => toggleSource(source.id, checked === true)}
                      className="border-white/20"
                    />
                    {source.label}
                  </label>
                ))}
              </div>
            </div>

            <Button type="button" onClick={() => runAction("index")} disabled={loadingAction === "index"} className="w-full gap-2 bg-emerald-300 text-slate-950 hover:bg-emerald-200">
              {loadingAction === "index" ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
              Quelle indexieren
            </Button>

            {error ? (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        </section>

        <section className="min-h-0 p-5">
          <ScrollArea className="h-full">
            <div className="space-y-4 pr-4">
              {results.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Treffer</h3>
                  {results.map((result, index) => (
                    <div key={`${result.source}-${result.uri}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-white">{result.title ?? "Untitled"}</div>
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                          {result.source ?? "unknown"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{result.uri}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{result.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {contextText && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-white">Kontext</h3>
                  <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{contextText}</pre>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Notizvorschläge</h3>
                  {suggestions.map((suggestion, index) => (
                    <div key={`${suggestion.title}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-white">{suggestion.title}</div>
                        <span className="text-xs text-slate-400">
                          {Math.round(Number(suggestion.confidence ?? 0) * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{suggestion.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(suggestion.links ?? []).map((link) => (
                          <span key={link} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">
                            [[{link}]]
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {edges.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <GitBranch className="h-4 w-4 text-cyan-200" />
                    Wissensgraph
                  </h3>
                  <div className="space-y-2">
                    {edges.map((edge, index) => (
                      <div key={`${edge.source}-${edge.target}-${index}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                        [[{edge.source}]] -&gt; [[{edge.target}]]
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {written.length > 0 && (
                <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                  <div className="font-medium">Geschrieben</div>
                  <ul className="mt-2 space-y-1">
                    {written.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeResult && !results.length && !suggestions.length && !edges.length && !contextText && !written.length && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <pre className="whitespace-pre-wrap text-sm text-slate-300">{JSON.stringify(activeResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}
