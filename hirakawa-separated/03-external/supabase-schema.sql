-- ==============================================================================
-- 03-EXTERNAL: Supabase Database Schema & Security Policies
-- ==============================================================================
-- 責任範囲: External（外部サービス側で実行・管理されるSQLスキーマとRLS定義）
-- Production側からは @supabase/supabase-js 経由でこのテーブルへアクセスします。
-- ==============================================================================

-- 1. ユーザー原稿・フォルダ・設定データ統合テーブル
CREATE TABLE IF NOT EXISTS public.user_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ユーザー個別設定テーブル（横文字数デフォルト、ツールバー順序、テーマ等）
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_stories_user_id ON public.user_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stories_updated_at ON public.user_stories(updated_at DESC);

-- 4. Row Level Security (RLS) の有効化
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 5. RLS ポリシー設定 (ユーザー自身のデータのみ読み書き可能)
-- user_stories
CREATE POLICY "Users can read own stories" 
    ON public.user_stories FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories" 
    ON public.user_stories FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories" 
    ON public.user_stories FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories" 
    ON public.user_stories FOR DELETE 
    USING (auth.uid() = user_id);

-- user_settings
CREATE POLICY "Users can read own settings" 
    ON public.user_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert or update own settings" 
    ON public.user_settings FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
