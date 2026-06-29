-- Jarvis platform hub persistence schema.
-- Stores first-class platform entities in Postgres while retaining JSONB payloads for
-- fast iteration on agent/workflow/tool manifests.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS platform_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_state (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  roles TEXT[] NOT NULL DEFAULT '{}',
  groups TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  members TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_roles (
  id TEXT PRIMARY KEY,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_sso_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS platform_sso_events (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_acls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource)
);

CREATE TABLE IF NOT EXISTS platform_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  model TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  tools TEXT[] NOT NULL DEFAULT '{}',
  knowledge TEXT[] NOT NULL DEFAULT '{}',
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'team',
  owner TEXT REFERENCES platform_users(id) ON DELETE SET NULL,
  package JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_marketplace_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  trust TEXT NOT NULL DEFAULT 'community',
  review_status TEXT NOT NULL DEFAULT 'pending',
  installed BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT NOT NULL DEFAULT '',
  checksum TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_path TEXT NOT NULL DEFAULT '',
  manifest_path TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  code TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  canvas JSONB NOT NULL DEFAULT '{}'::jsonb,
  versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT REFERENCES platform_workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  debug JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS platform_metric_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'platform',
  tool TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  agent_id TEXT NOT NULL DEFAULT '',
  workflow_id TEXT NOT NULL DEFAULT '',
  tokens BIGINT NOT NULL DEFAULT 0,
  cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
  latency_ms NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_knowledge_sources (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  uri TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  schedule TEXT NOT NULL DEFAULT 'manual',
  rag TEXT NOT NULL DEFAULT 'hybrid: bm25 + vector + cross-encoder reranker',
  vector_db TEXT NOT NULL DEFAULT 'chroma',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync TIMESTAMPTZ,
  next_sync TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS platform_knowledge_indexes (
  source_id TEXT PRIMARY KEY,
  vector_db TEXT NOT NULL DEFAULT 'chroma',
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  bm25 JSONB NOT NULL DEFAULT '{}'::jsonb,
  vectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  reranker TEXT NOT NULL DEFAULT 'cross-encoder',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_knowledge_searches (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  retrieval TEXT NOT NULL,
  source_ids TEXT[] NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_artifacts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  render_status TEXT NOT NULL DEFAULT 'ready',
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_publications (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES platform_agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  url TEXT NOT NULL,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_path TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_companion_sessions (
  id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_metric_events_created_at ON platform_metric_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metric_events_agent ON platform_metric_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_platform_workflow_runs_workflow ON platform_workflow_runs(workflow_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_artifacts_kind ON platform_artifacts(kind);
CREATE INDEX IF NOT EXISTS idx_platform_publications_agent ON platform_publications(agent_id);
