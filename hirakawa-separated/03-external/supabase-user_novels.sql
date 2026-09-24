-- アプリ(index.html / src/cloud/sync.js)が実際に使うテーブル user_novels の定義とRLS。
-- ※従来の supabase-schema.sql は user_stories 用で、コードとは別テーブルでした。
-- Supabase の SQL Editor で実行してください（既存テーブルがある場合は内容を確認してから）。

CREATE TABLE IF NOT EXISTS public.user_novels (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- upsert(onConflict:'user_id') に必要な一意制約
    data       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_novels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "novels_select_own" ON public.user_novels;
DROP POLICY IF EXISTS "novels_insert_own" ON public.user_novels;
DROP POLICY IF EXISTS "novels_update_own" ON public.user_novels;
DROP POLICY IF EXISTS "novels_delete_own" ON public.user_novels;

CREATE POLICY "novels_select_own" ON public.user_novels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "novels_insert_own" ON public.user_novels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "novels_update_own" ON public.user_novels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "novels_delete_own" ON public.user_novels FOR DELETE USING (auth.uid() = user_id);
