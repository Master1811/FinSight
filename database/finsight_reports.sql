-- ============================================================================
-- FINSIGHT REPORTS TABLE
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
-- ROW LEVEL SECURITY (RLS) POLICIES FOR FINSIGHT_REPORTS
-- ============================================================================

-- Enable RLS for the finsight_reports table
ALTER TABLE public.finsight_reports ENABLE ROW LEVEL SECURITY;

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