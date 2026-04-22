import { NextRequest, NextResponse } from 'next/server';
import { AnalyzeRequest, AnalyzeResponse } from '@/lib/finsight/types';
import { getFinSightConfig } from '@/lib/finsight/config';

// TODO: Implement request hashing and idempotent behavior
// TODO: Check for existing completed reports
// TODO: Queue Inngest job for report generation

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // Validate configuration
    const config = getFinSightConfig();

    // Parse and validate request body
    const body = await request.json();
    const analyzeRequest: AnalyzeRequest = body;

    // TODO: Add proper validation using zod schema
    if (!analyzeRequest.assetType || !analyzeRequest.symbols || !analyzeRequest.reportType) {
      return NextResponse.json(
        {
          jobId: '',
          status: 'queued',
          message: 'Invalid request: missing required fields'
        },
        { status: 400 }
      );
    }

    // TODO: Compute request hash for idempotency
    const requestHash = 'TODO-hash-' + Date.now();

    // TODO: Check if report already exists and return it

    // TODO: Queue Inngest job
    const jobId = 'finsight-job-' + Date.now();

    const response: AnalyzeResponse = {
      jobId,
      status: 'queued',
      message: 'Analysis job queued successfully'
    };

    return NextResponse.json(response, { status: 202 });

  } catch (error) {
    console.error('FinSight analyze error:', error);

    if (error instanceof Error && error.message.includes('configuration validation failed')) {
      return NextResponse.json(
        {
          jobId: '',
          status: 'queued',
          message: 'Service configuration error'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        jobId: '',
        status: 'queued',
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
}