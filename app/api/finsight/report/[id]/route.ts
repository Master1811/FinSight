import { NextRequest, NextResponse } from 'next/server';
import { ReportResponse } from '@/lib/finsight/types';
import { getFinSightConfig } from '@/lib/finsight/config';

// TODO: Implement report repository lookup
// TODO: Handle different report statuses (queued, running, done, failed)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ReportResponse>> {
  try {
    // Validate configuration
    const config = getFinSightConfig();

    const reportId = params.id;

    // TODO: Validate reportId format
    if (!reportId) {
      return NextResponse.json(
        {
          id: reportId,
          status: 'failed',
          requestHash: '',
          reportType: '',
          assets: [],
          error: 'Invalid report ID',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // TODO: Lookup report in database
    // For now, return 404 placeholder
    const reportResponse: ReportResponse = {
      id: reportId,
      status: 'failed', // 404 placeholder
      requestHash: 'placeholder-hash',
      reportType: 'single',
      assets: [],
      error: 'Report not found - placeholder implementation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json(reportResponse, { status: 404 });

  } catch (error) {
    console.error('FinSight report fetch error:', error);

    if (error instanceof Error && error.message.includes('configuration validation failed')) {
      return NextResponse.json(
        {
          id: params.id,
          status: 'failed',
          requestHash: '',
          reportType: '',
          assets: [],
          error: 'Service configuration error',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        id: params.id,
        status: 'failed',
        requestHash: '',
        reportType: '',
        assets: [],
        error: 'Internal server error',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}