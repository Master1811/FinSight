-- ============================================================================
-- FINSIGHT SUPABASE DATABASE SCHEMA
-- ============================================================================
-- This SQL script sets up all necessary tables for FinSight migration from MongoDB
-- Execute this in Supabase SQL Editor

-- ============================================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================================================
-- This table stores additional user profile information
-- The id column is a foreign key to auth.users(id)

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  country text,
  investment_goals text,
  risk_tolerance text,
  preferred_industry text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add table comment
COMMENT ON TABLE public.profiles IS 'Extended user profile information beyond auth.users';

-- Create indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- ============================================================================
-- 2. WATCHLIST TABLE
-- ============================================================================
-- Stores user watchlist items (stocks they're monitoring)

CREATE TABLE IF NOT EXISTS public.watchlist (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol varchar(10) NOT NULL,
  company text NOT NULL,
  added_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_symbol UNIQUE(user_id, symbol)
);

-- Add table comment
COMMENT ON TABLE public.watchlist IS 'User watchlist items - stocks being monitored';

-- Create indexes for watchlist table
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON public.watchlist(symbol);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at ON public.watchlist(added_at DESC);

-- ============================================================================
-- 3. FINSIGHT REPORTS TABLE
-- ============================================================================
-- Table for storing FinSight analysis reports with caching and status tracking

CREATE TABLE IF NOT EXISTS public.finsight_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash varchar(64) NOT NULL, -- SHA-256 hash of the analysis request for deduplication
  report_type varchar(20) NOT NULL CHECK (report_type IN ('single', 'comparison', 'portfolio')),
  assets_json jsonb NOT NULL, -- Array of asset symbols/scheme codes being analyzed
  status varchar(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  content_json jsonb, -- Final report content (sections, analysis, etc.)
  metadata_json jsonb, -- Additional metadata (timestamps, sources, etc.)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add table comment
COMMENT ON TABLE public.finsight_reports IS 'FinSight analysis reports with caching and status tracking';

-- Create unique index on request_hash to ensure immutable cache reuse
CREATE UNIQUE INDEX IF NOT EXISTS idx_finsight_reports_request_hash ON public.finsight_reports(request_hash);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_finsight_reports_status ON public.finsight_reports(status);
CREATE INDEX IF NOT EXISTS idx_finsight_reports_report_type ON public.finsight_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_finsight_reports_created_at ON public.finsight_reports(created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS for security

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finsight_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3a. PROFILES RLS POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3b. WATCHLIST RLS POLICIES
-- ============================================================================

-- Users can view their own watchlist
CREATE POLICY "Users can view their own watchlist"
  ON public.watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert into their own watchlist
CREATE POLICY "Users can insert into their own watchlist"
  ON public.watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3c. FINSIGHT_REPORTS RLS POLICIES
-- ============================================================================

-- Service role can do everything (for background jobs and admin operations)
CREATE POLICY "Service role has full access to finsight_reports"
  ON public.finsight_reports
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow anonymous read access for report retrieval (since reports are public once generated)
-- This allows the API to fetch reports without authentication
CREATE POLICY "Allow read access to finsight_reports for report retrieval"
  ON public.finsight_reports
  FOR SELECT
  USING (true);

-- Note: For future user-specific reports, we can add user_id column and policies like:
-- CREATE POLICY "Users can view their own reports"
--   ON public.finsight_reports
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- Users can update their own watchlist
CREATE POLICY "Users can update their own watchlist"
  ON public.watchlist
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete from their own watchlist
CREATE POLICY "Users can delete from their own watchlist"
  ON public.watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. TRIGGERS (OPTIONAL - AUTO UPDATE updated_at)
-- ============================================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. HELPER FUNCTION - Get user profile with user data
-- ============================================================================
-- Optional: Useful for fetching complete user information

CREATE OR REPLACE FUNCTION public.get_user_profile(user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  country text,
  investment_goals text,
  risk_tolerance text,
  preferred_industry text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    au.email,
    p.name,
    p.country,
    p.investment_goals,
    p.risk_tolerance,
    p.preferred_industry,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE p.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTION - Get user watchlist with details
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_watchlist(user_id uuid)
RETURNS TABLE (
  id bigint,
  symbol varchar,
  company text,
  added_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.symbol,
    w.company,
    w.added_at
  FROM public.watchlist w
  WHERE w.user_id = user_id
  ORDER BY w.added_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VERIFICATION QUERIES (Run these to verify everything is set up)
-- ============================================================================
-- Uncomment to run after setup

-- SELECT 'Profiles table' as check, COUNT(*) as row_count FROM public.profiles;
-- SELECT 'Watchlist table' as check, COUNT(*) as row_count FROM public.watchlist;
-- SELECT 'FinSight Reports table' as check, COUNT(*) as row_count FROM public.finsight_reports;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- SELECT * FROM information_schema.table_constraints WHERE table_schema = 'public';

-- ============================================================================
-- END OF SCHEMA SETUP
-- ============================================================================
