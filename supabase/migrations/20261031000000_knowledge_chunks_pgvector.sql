-- ================================================================
-- Knowledge chunks + pgvector (hybrid retrieval)
--
-- Merchant Q&A stays in public.knowledge_base and remains the
-- highest-priority source. This migration stores the full uploaded
-- document as overlapping chunks, plus one chunk per Q&A row, with a
-- 768-dimension embedding (Gemini gemini-embedding-001 at
-- outputDimensionality 768, or OpenAI text-embedding-3-small at
-- dimensions 768). A 404 on the Gemini model falls back once to
-- text-embedding-004, which Google retired on 2026-01-14, so set
-- GEMINI_EMBEDDING_MODEL if the primary model is gone. The dimension is
-- fixed: changing it needs a new migration
-- and a re-index. It must match EMBEDDING_DIMENSIONS in
-- src/lib/knowledge/embed.ts.
--
-- Do not apply this against production from the app. Run it yourself:
--   supabase db push
-- or paste this file into the Supabase SQL editor for the target project.
-- Then backfill with: node --import ./scripts/register-hooks.mjs --experimental-strip-types scripts/reindex-knowledge.mjs
-- The app keeps answering from knowledge_base until chunks exist.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Unqualified vector / gin_trgm_ops resolve whether the extension landed in
-- extensions (Supabase default) or was already installed in public.
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_shop_source_ref
  ON public.knowledge_documents (shop_id, source, source_ref);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  knowledge_base_id UUID REFERENCES public.knowledge_base(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('qa', 'document')),
  priority SMALLINT NOT NULL DEFAULT 10 CHECK (priority >= 0 AND priority <= 100),
  source_file TEXT,
  section TEXT,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_key TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(768),
  embedding_model TEXT,
  embedding_status TEXT NOT NULL DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'ready', 'failed')),
  embedding_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_chunks_shop_key UNIQUE (shop_id, chunk_key),
  CONSTRAINT knowledge_chunks_one_parent CHECK (
    (source_kind = 'qa' AND knowledge_base_id IS NOT NULL AND document_id IS NULL)
    OR
    (source_kind = 'document' AND document_id IS NOT NULL AND knowledge_base_id IS NULL)
  ),
  CONSTRAINT knowledge_chunks_embedding_state CHECK (
    (embedding_status = 'ready' AND embedding IS NOT NULL)
    OR
    (embedding_status IN ('pending', 'failed') AND embedding IS NULL)
  )
);

-- simple tsvector: useful for product codes, English, and prices.
-- Thai has no dictionary here; Thai recall comes from pg_trgm + the app reranker.
ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(source_file, '') || ' ' || coalesce(section, '') || ' ' || content
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS knowledge_chunks_document_id
  ON public.knowledge_chunks (document_id);

CREATE INDEX IF NOT EXISTS knowledge_chunks_knowledge_base_id
  ON public.knowledge_chunks (knowledge_base_id);

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw
  ON public.knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm
  ON public.knowledge_chunks
  USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_chunks_section_trgm
  ON public.knowledge_chunks
  USING gin (section gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv
  ON public.knowledge_chunks
  USING gin (content_tsv);

-- Shop members only. Service role bypasses RLS, so every function below also
-- filters on p_shop_id. Same membership test as the other shop tables,
-- including shops.owner_id when that column exists.
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  shop_scope TEXT := 'shop_id IN (SELECT workspace_id FROM public.users WHERE id = auth.uid())';
  t TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'owner_id'
  ) THEN
    shop_scope := shop_scope || ' OR shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())';
  END IF;
  shop_scope := '(' || shop_scope || ')';

  FOREACH t IN ARRAY ARRAY['knowledge_documents', 'knowledge_chunks']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Shop members manage own rows', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING %s WITH CHECK %s',
      'Shop members manage own rows', t, shop_scope, shop_scope
    );
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.knowledge_documents FROM anon;
REVOKE ALL ON TABLE public.knowledge_chunks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_documents TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.knowledge_chunks TO authenticated, service_role;

-- Cosine similarity, shop-scoped. hnsw.iterative_scan (pgvector 0.8+) keeps
-- the shop filter from dropping true neighbours; older pgvector ignores it.
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  p_shop_id UUID,
  p_query_embedding vector,
  p_match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  content TEXT,
  source_file TEXT,
  section TEXT,
  source_kind TEXT,
  priority SMALLINT,
  chunk_index INTEGER,
  knowledge_base_id UUID,
  document_id UUID,
  vector_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  match_count INTEGER := LEAST(GREATEST(COALESCE(p_match_count, 20), 1), 50);
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop id is required';
  END IF;
  IF p_query_embedding IS NULL OR vector_dims(p_query_embedding) <> 768 THEN
    RAISE EXCEPTION 'query embedding must be 768 dimensions';
  END IF;

  BEGIN
    PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);
    PERFORM set_config('hnsw.ef_search', '100', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    c.id,
    c.shop_id,
    c.content,
    c.source_file,
    c.section,
    c.source_kind,
    c.priority,
    c.chunk_index,
    c.knowledge_base_id,
    c.document_id,
    (1 - (c.embedding <=> p_query_embedding))::REAL AS vector_score
  FROM public.knowledge_chunks c
  WHERE c.shop_id = p_shop_id
    AND c.embedding IS NOT NULL
    AND c.embedding_status = 'ready'
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT match_count;
END;
$$;

-- Keyword recall for Thai (trigram / word_similarity), product codes, and prices.
-- plainto_tsquery ANDs every token, which drops a Thai sentence that merely
-- contains a SKU, so codes and numbers are OR-matched on their own.
CREATE OR REPLACE FUNCTION public.search_knowledge_chunks_keyword(
  p_shop_id UUID,
  p_query TEXT,
  p_match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  content TEXT,
  source_file TEXT,
  section TEXT,
  source_kind TEXT,
  priority SMALLINT,
  chunk_index INTEGER,
  knowledge_base_id UUID,
  document_id UUID,
  keyword_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  q TEXT := left(btrim(COALESCE(p_query, '')), 500);
  like_q TEXT;
  tsq tsquery;
  match_count INTEGER := LEAST(GREATEST(COALESCE(p_match_count, 20), 1), 50);
BEGIN
  IF p_shop_id IS NULL THEN
    RAISE EXCEPTION 'shop id is required';
  END IF;
  IF q = '' THEN
    RETURN;
  END IF;

  like_q := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  BEGIN
    tsq := plainto_tsquery('simple', q);
    IF tsq IS NULL OR numnode(tsq) = 0 THEN
      tsq := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    tsq := NULL;
  END;

  BEGIN
    PERFORM set_config('pg_trgm.word_similarity_threshold', '0.35', true);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    c.id,
    c.shop_id,
    c.content,
    c.source_file,
    c.section,
    c.source_kind,
    c.priority,
    c.chunk_index,
    c.knowledge_base_id,
    c.document_id,
    (
      CASE
        WHEN c.content ILIKE like_q ESCAPE '\' THEN 1.0
        WHEN coalesce(c.section, '') ILIKE like_q ESCAPE '\' THEN 0.85
        WHEN coalesce(c.source_file, '') ILIKE like_q ESCAPE '\' THEN 0.7
        ELSE 0
      END
      + CASE WHEN tsq IS NOT NULL AND c.content_tsv @@ tsq THEN 0.35 ELSE 0 END
      + COALESCE(word_similarity(q, c.content), 0) * 0.5
      + COALESCE(word_similarity(q, coalesce(c.section, '')), 0) * 0.3
    )::REAL AS keyword_score
  FROM public.knowledge_chunks c
  WHERE c.shop_id = p_shop_id
    AND (
      c.content ILIKE like_q ESCAPE '\'
      OR coalesce(c.section, '') ILIKE like_q ESCAPE '\'
      OR coalesce(c.source_file, '') ILIKE like_q ESCAPE '\'
      OR (tsq IS NOT NULL AND c.content_tsv @@ tsq)
      OR q <% c.content
      OR q <% coalesce(c.section, '')
      OR EXISTS (
        SELECT 1
        FROM regexp_matches(q, '[A-Za-z0-9][A-Za-z0-9._/-]{2,}', 'g') AS token
        WHERE c.content ILIKE '%' || replace(replace(replace(token[1], '\', '\\'), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
      )
      OR EXISTS (
        SELECT 1
        FROM regexp_matches(q, '\d{2,}', 'g') AS token
        WHERE c.content ILIKE '%' || token[1] || '%'
      )
    )
  ORDER BY keyword_score DESC, c.priority DESC, c.chunk_index ASC
  LIMIT match_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_knowledge_chunks(UUID, vector, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_knowledge_chunks_keyword(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(UUID, vector, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_knowledge_chunks_keyword(UUID, TEXT, INTEGER) TO authenticated, service_role;

SELECT 'Knowledge chunks pgvector schema applied successfully' AS result;
