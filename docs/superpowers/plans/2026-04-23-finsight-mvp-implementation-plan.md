# FinSight MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working FinSight MVP inside the existing Next.js app with resilient data ingestion, quant analytics, and AI-generated single/comparison/portfolio reports.

**Architecture:** Use Next.js as orchestration + API/UI layer, add a small Python FastAPI service only for yfinance and quant-heavy computation, and keep report generation + jobs in Next.js/Inngest. Implement provider adapters with cache + fallback + graceful degradation to avoid user-facing failures.

**Tech Stack:** Next.js 15, React, Supabase, Inngest, Node route handlers, Python FastAPI, Redis (Upstash), Anthropic API, optional OpenAI fallback.

---

## Scope Decomposition (independent subprojects)

1. **Core Platform**: provider adapters, caching, health/degradation, API contracts
2. **Data Ingestion**: equity/gold/macro/MF source integration with fallbacks
3. **Quant Engine**: returns, risk, technicals, portfolio metrics
4. **Report Engine**: LLM prompts, report generation, persistence, fallback model
5. **UI Layer**: FinSight screens/components with Suspense and job progress UX
6. **Developer API**: `/api/finsight/analyze` + `/api/finsight/report/:id`

---

### Task 1: Create FinSight Module Skeleton (Next.js)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/analyze/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/report/[id]/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/health/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/types.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/config.ts`

- [ ] Define shared request/response interfaces in `lib/finsight/types.ts` for `AnalyzeRequest`, `AnalyzeResponse`, `ReportResponse`, `HealthResponse`.
- [ ] Add environment validation in `lib/finsight/config.ts` for Anthropic, Redis, Python service URL, fallback provider flags.
- [ ] Stub route handlers with TODO-safe JSON contracts and HTTP status handling.
- [ ] Add minimal smoke test plan (curl-based) for all 3 routes.
- [ ] Commit: `feat: scaffold finsight API module and typed contracts`.

**Acceptance criteria:**
- `POST /api/finsight/analyze` returns typed JSON shape.
- `GET /api/finsight/report/:id` returns 404 placeholder with valid schema.
- `GET /api/finsight/health` returns provider matrix skeleton.

---

### Task 2: Add Report Persistence Schema (Supabase)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/database/finsight_reports.sql`
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/supabase-schema.sql`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/reports.repo.ts`

- [ ] Add `finsight_reports` table: `id`, `request_hash`, `report_type`, `assets_json`, `status`, `content_json`, `metadata_json`, `created_at`, `updated_at`.
- [ ] Add unique index on `request_hash` to ensure immutable cache reuse.
- [ ] Add repository functions: `findByHash`, `createQueued`, `markRunning`, `markDone`, `markFailed`, `getById`.
- [ ] Add RLS policy: owner-only if tied to user, and service-role write for background jobs.
- [ ] Commit: `feat: add finsight reports persistence and repository`.

**Acceptance criteria:**
- Running SQL creates table and indexes without errors.
- Repository can create/read/update report status.

---

### Task 3: Implement Provider Adapter Interfaces + Cache Wrapper

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/provider.types.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/cache.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/provider.registry.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/degrade.ts`

- [ ] Define adapter contracts: `EquityProvider`, `MutualFundProvider`, `MacroProvider`, `LlmProvider`.
- [ ] Implement cache helper with key prefixing, TTL map, stale-while-revalidate metadata.
- [ ] Build registry resolving primary/fallback provider by env.
- [ ] Add `degrade.ts` utility returning `{ data, asOf, isStale, source, degradedReason }`.
- [ ] Commit: `feat: add provider abstraction and stale-safe response utilities`.

**Acceptance criteria:**
- Any provider output can be normalized to the degrade contract.
- Cache helper supports per-domain TTL.

---

### Task 4: Integrate MF API + AMFI Fallback in Next.js

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/mf/mfapi.provider.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/mf/amfi.provider.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/mf/mf.service.ts`

- [ ] Implement MFAPI scheme search + history fetch.
- [ ] Implement AMFI NAVAll.txt parser fallback and normalize scheme structure.
- [ ] Add service logic: primary -> fallback -> stale cache path.
- [ ] Add 24h cache policy for NAV history and scheme metadata.
- [ ] Commit: `feat: add mutual fund data service with AMFI fallback`.

**Acceptance criteria:**
- MF history returns even when primary endpoint fails (if fallback/cached present).
- Response carries source + stale metadata.

---

### Task 5: Stand Up Python FastAPI Market Service (yfinance + quant base)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/app/main.py`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/app/routes/prices.py`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/app/routes/gold.py`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/app/routes/metrics.py`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/requirements.txt`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/services/market-api/README.md`

- [ ] Implement `/prices/live`, `/prices/history`, `/gold/inr`, `/metrics/basic` endpoints.
- [ ] Normalize ticker mapping for NSE/BSE symbols and timezone handling (IST).
- [ ] Add request timeout + retry wrappers around yfinance calls.
- [ ] Return typed JSON with explicit `as_of` and missing-data flags.
- [ ] Commit: `feat: add market FastAPI service for yfinance-backed price and gold data`.

**Acceptance criteria:**
- Service runs locally and returns live/history payloads.
- Next.js can call service via internal base URL.

---

### Task 6: Add Macro Service (World Bank + RBI JSON fallback)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/macro/worldbank.provider.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/macro/rbi.provider.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/macro/macro-fallback.json`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/providers/macro/macro.service.ts`

- [ ] Integrate World Bank inflation indicator fetch and transform.
- [ ] Add RBI repo snapshot fetch/parser (best-effort) with safe fallback to `macro-fallback.json`.
- [ ] Cache macro responses for 7 days.
- [ ] Add freshness timestamp and stale indicator.
- [ ] Commit: `feat: add macro provider with long-TTL cache and fallback dataset`.

**Acceptance criteria:**
- Macro endpoint always returns a valid payload (live, fallback, or cached stale).

---

### Task 7: Implement Quant Metrics Library (Node side)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/quant/returns.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/quant/risk.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/quant/technicals.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/quant/portfolio.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/quant/__tests__/quant.test.ts`

- [ ] Implement CAGR periods: 1W/1M/3M/6M/1Y/3Y/5Y.
- [ ] Implement Sharpe, Sortino, Calmar, Max Drawdown, VaR95.
- [ ] Implement RSI, 50/200 DMA crossover, 52-week high/low.
- [ ] Implement correlation matrix + Herfindahl concentration index.
- [ ] Add deterministic unit tests for each metric function.
- [ ] Commit: `feat: add quant metrics engine with tests`.

**Acceptance criteria:**
- Quant functions are pure and test-covered.
- Missing-data inputs return explicit null/error codes, not crashes.

---

### Task 8: Build Analyze Orchestrator Endpoint

**Files:**
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/analyze/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/analyze.service.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/hash.ts`

- [ ] Validate payload (`assetType`, symbols/scheme codes, reportType, horizon).
- [ ] Compute request hash and return existing completed report if present.
- [ ] Queue report job (Inngest event) and return `{ jobId, status: queued }`.
- [ ] Add idempotent behavior for duplicate requests.
- [ ] Commit: `feat: implement finsight analyze orchestration with idempotent report queueing`.

**Acceptance criteria:**
- Repeated same request reuses cached report.
- New requests queue successfully with job id.

---

### Task 9: Implement LLM Report Generation Pipeline (Inngest)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/prompts/single-asset.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/prompts/compare-assets.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/prompts/portfolio.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/llm/anthropic.client.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/llm/openai-fallback.client.ts`
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/inngest/functions.ts`

- [ ] Add `finsight/report.generate` event handler.
- [ ] Gather normalized data bundle from services/providers before prompt call.
- [ ] Generate 5-section memo with strict JSON schema output.
- [ ] If Anthropic fails, retry via OpenAI fallback provider.
- [ ] Persist final report JSON and mark status transitions.
- [ ] Commit: `feat: add finsight report generation job with fallback llm provider`.

**Acceptance criteria:**
- Single/comparison/portfolio jobs complete and persist outputs.
- Failure modes are recorded and queryable.

---

### Task 10: Build Report Retrieval + Progress APIs

**Files:**
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/report/[id]/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/report/[id]/stream/route.ts`

- [ ] Implement report fetch endpoint with status mapping (`queued/running/done/failed`).
- [ ] Add SSE streaming endpoint for partial report text (single-asset MVP path).
- [ ] Include stale/source metadata in final response envelope.
- [ ] Commit: `feat: add report status and stream APIs`.

**Acceptance criteria:**
- UI can poll and/or stream report progress without timeouts.

---

### Task 11: FinSight UI MVP Pages + Components

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/(root)/finsight/page.tsx`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/AssetInputForm.tsx`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/MetricStrip.tsx`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/TechnicalSignalCard.tsx`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/ReportProgress.tsx`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/ReportViewer.tsx`
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/constants.ts`

- [ ] Add `FinSight` nav item and route.
- [ ] Build form to analyze single/comparison/portfolio inputs.
- [ ] Implement job progress polling UX with degraded-state banners.
- [ ] Render report sections with data timestamp + SEBI-safe disclaimer block.
- [ ] Commit: `feat: add finsight mvp ui flow with report progress and viewer`.

**Acceptance criteria:**
- User can submit analysis and see report lifecycle end-to-end.

---

### Task 12: Daily Macro Pulse (background + cache)

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/macro-pulse.ts`
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/inngest/functions.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/macro-pulse/latest/route.ts`

- [ ] Add daily cron function producing macro pulse snapshot.
- [ ] Persist latest pulse in Supabase or Redis.
- [ ] Serve pulse via lightweight endpoint for dashboard card.
- [ ] Commit: `feat: add daily macro pulse generation and endpoint`.

**Acceptance criteria:**
- Endpoint always serves latest cached pulse even if live sources fail.

---

### Task 13: Dependency Health + Graceful Degradation

**Files:**
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/app/api/finsight/health/route.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/health/checks.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/components/finsight/DataFreshnessBadge.tsx`

- [ ] Implement active health checks for each provider and cache availability.
- [ ] Expose health summary in JSON.
- [ ] Add frontend badges: `Live`, `Cached`, `Stale`, `Fallback`.
- [ ] Commit: `feat: add dependency health model and degraded UX indicators`.

**Acceptance criteria:**
- Product remains functional under single-provider outage.

---

### Task 14: Compliance + Content Safety Guardrails

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/compliance/disclaimer.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/compliance/language-guard.ts`
- Modify: `/Users/shresth1811/Documents/PROJECTS/FinSight/lib/finsight/prompts/*.ts`

- [ ] Add mandatory disclaimer text helper injected into every report payload.
- [ ] Add post-generation content guard blocking imperative advice phrases.
- [ ] Add source/timestamp attribution section to report schema.
- [ ] Commit: `feat: add compliance disclaimers and output language guardrails`.

**Acceptance criteria:**
- Every report includes disclaimer + source timestamp + non-advisory framing.

---

### Task 15: Testing + Observability + Runbook

**Files:**
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/tests/finsight/api.test.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/tests/finsight/providers.test.ts`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/tests/finsight/e2e-report-flow.md`
- Create: `/Users/shresth1811/Documents/PROJECTS/FinSight/docs/finsight-runbook.md`

- [ ] Add API integration tests for analyze/report/health.
- [ ] Add provider fallback tests (force primary failures).
- [ ] Document on-call recovery steps for each provider outage mode.
- [ ] Add sample curl commands for developer API embedding.
- [ ] Commit: `test/docs: add finsight integration tests and outage runbook`.

**Acceptance criteria:**
- CI catches provider/fallback regressions.
- Runbook enables rapid recovery without code changes.

---

## Execution order recommendation (fastest MVP)

1. Task 1 -> 2 -> 3 (platform skeleton)
2. Task 4 + 5 + 6 (data providers)
3. Task 7 + 8 (analytics + orchestration)
4. Task 9 + 10 (report engine)
5. Task 11 (UI)
6. Task 13 + 14 + 15 (hardening)
7. Task 12 can run in parallel after Task 6

## MVP freeze line

To ship earliest working MVP, stop after Tasks: **1,2,3,4,5,7,8,9,10,11**.
Then harden with 13/14/15.

