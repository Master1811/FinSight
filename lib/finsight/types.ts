/**
 * Shared request/response interfaces for FinSight API module
 */

export interface AnalyzeRequest {
  assetType: 'equity' | 'mutual-fund' | 'portfolio';
  symbols: string[]; // stock symbols or scheme codes
  reportType: 'single' | 'comparison' | 'portfolio';
  horizon: '1W' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y';
}

export interface AnalyzeResponse {
  jobId: string;
  status: 'queued';
  message: string;
}

export interface ReportResponse {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  requestHash: string;
  reportType: string;
  assets: string[];
  content?: {
    sections: Array<{
      title: string;
      content: string;
    }>;
    metadata: {
      generatedAt: string;
      dataAsOf: string;
      source: string;
      isStale?: boolean;
    };
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: {
    [key: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastChecked: string;
      message?: string;
    };
  };
  timestamp: string;
}