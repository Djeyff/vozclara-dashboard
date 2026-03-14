-- VozClara + Retena — Initial Schema
-- Migration: 001_initial.sql
-- vector(1536) matches OpenAI text-embedding-3-small / Cohere embed-multilingual-v3.0

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════
-- SHARED: USERS & AUTH
-- ═══════════════════════════════════════

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               TEXT UNIQUE,
  phone               TEXT UNIQUE,
  name                TEXT,
  paddle_customer_id  TEXT UNIQUE,
  -- VozClara tier: free | basic | pro | business
  vc_tier             TEXT NOT NULL DEFAULT 'free' CHECK (vc_tier IN ('free','basic','pro','business')),
  -- Retena tier: none | starter | pro | business
  rt_tier             TEXT NOT NULL DEFAULT 'none' CHECK (rt_tier IN ('none','starter','pro','business')),
  -- VozClara usage counters (legacy — prefer vc_usage table)
  daily_notes_used    INT NOT NULL DEFAULT 0,
  notes_today         INT NOT NULL DEFAULT 0,
  audio_minutes_used  FLOAT NOT NULL DEFAULT 0,
  daily_notes_limit   INT NOT NULL DEFAULT 5,
  last_reset_date     DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_phone       ON users(phone);
CREATE INDEX idx_users_paddle_id   ON users(paddle_customer_id);
CREATE INDEX idx_users_vc_tier     ON users(vc_tier);

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  app         TEXT NOT NULL DEFAULT 'vozclara' CHECK (app IN ('vozclara','retena')),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token    ON sessions(token);
CREATE INDEX idx_sessions_user_id  ON sessions(user_id);
CREATE INDEX idx_sessions_expires  ON sessions(expires_at);

CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash      TEXT NOT NULL UNIQUE,
  key_preview   TEXT NOT NULL,       -- last 6 chars for display
  name          TEXT NOT NULL DEFAULT 'Default key',
  app           TEXT NOT NULL DEFAULT 'vozclara',
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash     ON api_keys(key_hash);

CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  paddle_customer_id  TEXT,
  paddle_tx_id        TEXT UNIQUE,
  amount_cents        INT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USD',
  tier                TEXT,
  app                 TEXT,
  status              TEXT NOT NULL DEFAULT 'completed',
  invoice_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_paddle  ON invoices(paddle_customer_id);

-- ═══════════════════════════════════════
-- VOZCLARA: TRANSCRIPTS & FOLDERS
-- ═══════════════════════════════════════

CREATE TABLE vc_folders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vc_folders_user_id ON vc_folders(user_id);

CREATE TABLE vc_transcripts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id        UUID REFERENCES vc_folders(id) ON DELETE SET NULL,
  -- text may be AES-256-GCM encrypted; plaintext if encryption_iv IS NULL
  text             TEXT NOT NULL,
  encryption_iv    TEXT,
  language         TEXT NOT NULL DEFAULT 'en',
  source           TEXT NOT NULL DEFAULT 'whatsapp'
                   CHECK (source IN ('whatsapp','telegram','chrome','upload','api')),
  duration_seconds INT NOT NULL DEFAULT 0,
  starred          BOOLEAN NOT NULL DEFAULT FALSE,
  -- summary stored as JSONB: { keyPoints: [], actionItems: [] }
  summary          JSONB,
  translation      TEXT,
  sender_name      TEXT,
  chat_name        TEXT,
  from_number      TEXT,
  telegram_id      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vc_transcripts_user_id    ON vc_transcripts(user_id);
CREATE INDEX idx_vc_transcripts_folder_id  ON vc_transcripts(folder_id);
CREATE INDEX idx_vc_transcripts_created_at ON vc_transcripts(created_at DESC);
CREATE INDEX idx_vc_transcripts_starred    ON vc_transcripts(user_id, starred) WHERE starred = TRUE;
CREATE INDEX idx_vc_transcripts_source     ON vc_transcripts(user_id, source);

CREATE TABLE vc_usage (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  notes_count      INT NOT NULL DEFAULT 0,
  audio_minutes    FLOAT NOT NULL DEFAULT 0,
  ai_searches      INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_vc_usage_user_date ON vc_usage(user_id, date DESC);

-- ═══════════════════════════════════════
-- VOZCLARA: VECTOR EMBEDDINGS
-- ═══════════════════════════════════════

CREATE TABLE vc_embeddings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id  UUID NOT NULL REFERENCES vc_transcripts(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding      vector(1536) NOT NULL,  -- OpenAI text-embedding-3-small
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vc_embeddings_transcript ON vc_embeddings(transcript_id);
CREATE INDEX idx_vc_embeddings_user_id    ON vc_embeddings(user_id);

-- HNSW index: cosine similarity for multilingual semantic search
CREATE INDEX idx_vc_embeddings_hnsw ON vc_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════
-- RETENA: WORKSPACES & TEAMS
-- ═══════════════════════════════════════

CREATE TABLE rt_workspaces (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                TEXT NOT NULL,
  paddle_customer_id  TEXT UNIQUE,
  rt_tier             TEXT NOT NULL DEFAULT 'starter'
                      CHECK (rt_tier IN ('starter','pro','business')),
  wa_business_number  TEXT,           -- Track 2: own WA Business number
  wa_verify_token     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_workspaces_owner ON rt_workspaces(owner_user_id);

CREATE TABLE rt_workspace_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_rt_workspace_members_ws   ON rt_workspace_members(workspace_id);
CREATE INDEX idx_rt_workspace_members_user ON rt_workspace_members(user_id);

-- ═══════════════════════════════════════
-- RETENA: GROUPS
-- ═══════════════════════════════════════

CREATE TABLE rt_groups (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  wa_group_id   TEXT,               -- WhatsApp group JID
  description   TEXT,
  member_count  INT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  last_activity TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_groups_workspace_id ON rt_groups(workspace_id);
CREATE INDEX idx_rt_groups_wa_group_id  ON rt_groups(wa_group_id);
CREATE INDEX idx_rt_groups_last_activity ON rt_groups(workspace_id, last_activity DESC);

CREATE TABLE rt_group_members (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id  UUID NOT NULL REFERENCES rt_groups(id) ON DELETE CASCADE,
  phone     TEXT NOT NULL,
  name      TEXT,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, phone)
);

CREATE INDEX idx_rt_group_members_group ON rt_group_members(group_id);
CREATE INDEX idx_rt_group_members_phone ON rt_group_members(phone);

-- ═══════════════════════════════════════
-- RETENA: MESSAGES
-- ═══════════════════════════════════════

CREATE TABLE rt_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES rt_groups(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  sender_phone    TEXT NOT NULL,
  sender_name     TEXT,
  message_type    TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','voice','image','document','sticker')),
  text            TEXT,              -- transcribed text for voice; raw text for messages
  has_voice_note  BOOLEAN NOT NULL DEFAULT FALSE,
  duration_seconds INT,
  language        TEXT DEFAULT 'es',
  wa_message_id   TEXT UNIQUE,       -- WhatsApp message ID (dedup)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_messages_group_id      ON rt_messages(group_id);
CREATE INDEX idx_rt_messages_workspace_id  ON rt_messages(workspace_id);
CREATE INDEX idx_rt_messages_created_at    ON rt_messages(group_id, created_at DESC);
CREATE INDEX idx_rt_messages_sender        ON rt_messages(group_id, sender_phone);
CREATE INDEX idx_rt_messages_voice_notes   ON rt_messages(group_id) WHERE has_voice_note = TRUE;

-- ═══════════════════════════════════════
-- RETENA: SUMMARIES
-- ═══════════════════════════════════════

CREATE TABLE rt_summaries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES rt_groups(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  period_type   TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  period_date   DATE NOT NULL,       -- start date of period
  summary_text  TEXT NOT NULL,
  key_topics    JSONB,               -- array of topic strings
  action_items  JSONB,               -- array of action item strings
  message_count INT NOT NULL DEFAULT 0,
  voice_count   INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, period_type, period_date)
);

CREATE INDEX idx_rt_summaries_group_id    ON rt_summaries(group_id);
CREATE INDEX idx_rt_summaries_period      ON rt_summaries(group_id, period_type, period_date DESC);
CREATE INDEX idx_rt_summaries_workspace   ON rt_summaries(workspace_id, period_date DESC);

-- ═══════════════════════════════════════
-- RETENA: USAGE
-- ═══════════════════════════════════════

CREATE TABLE rt_usage (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  messages_count       INT NOT NULL DEFAULT 0,
  transcriptions_count INT NOT NULL DEFAULT 0,
  ai_searches          INT NOT NULL DEFAULT 0,
  audio_minutes        FLOAT NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, date)
);

CREATE INDEX idx_rt_usage_workspace_date ON rt_usage(workspace_id, date DESC);

-- ═══════════════════════════════════════
-- RETENA: VECTOR EMBEDDINGS
-- ═══════════════════════════════════════

CREATE TABLE rt_embeddings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id    UUID NOT NULL REFERENCES rt_messages(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES rt_groups(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES rt_workspaces(id) ON DELETE CASCADE,
  embedding     vector(1536) NOT NULL,  -- OpenAI text-embedding-3-small
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_embeddings_message_id   ON rt_embeddings(message_id);
CREATE INDEX idx_rt_embeddings_group_id     ON rt_embeddings(group_id);
CREATE INDEX idx_rt_embeddings_workspace_id ON rt_embeddings(workspace_id);

-- HNSW index: cosine similarity, scoped searches by group_id at query time
CREATE INDEX idx_rt_embeddings_hnsw ON rt_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════

-- Semantic search: VozClara transcripts for a specific user
CREATE OR REPLACE FUNCTION match_vc_transcripts(
  query_embedding  vector(1536),
  p_user_id        UUID,
  match_count      INT DEFAULT 10,
  match_threshold  FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  transcript_id  UUID,
  text           TEXT,
  language       TEXT,
  source         TEXT,
  created_at     TIMESTAMPTZ,
  similarity     FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    vt.id,
    vt.text,
    vt.language,
    vt.source,
    vt.created_at,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM vc_embeddings ve
  JOIN vc_transcripts vt ON vt.id = ve.transcript_id
  WHERE ve.user_id = p_user_id
    AND 1 - (ve.embedding <=> query_embedding) > match_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Semantic search: Retena messages scoped to workspace (optionally group)
CREATE OR REPLACE FUNCTION match_rt_messages(
  query_embedding  vector(1536),
  p_workspace_id   UUID,
  p_group_id       UUID DEFAULT NULL,
  match_count      INT DEFAULT 10,
  match_threshold  FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  message_id    UUID,
  text          TEXT,
  sender_name   TEXT,
  language      TEXT,
  group_id      UUID,
  created_at    TIMESTAMPTZ,
  similarity    FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    rm.id,
    rm.text,
    rm.sender_name,
    rm.language,
    rm.group_id,
    rm.created_at,
    1 - (re.embedding <=> query_embedding) AS similarity
  FROM rt_embeddings re
  JOIN rt_messages rm ON rm.id = re.message_id
  WHERE re.workspace_id = p_workspace_id
    AND (p_group_id IS NULL OR re.group_id = p_group_id)
    AND rm.text IS NOT NULL
    AND 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rt_workspaces_updated_at
  BEFORE UPDATE ON rt_workspaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
