/**
 * Repository for FinSight reports persistence
 */

import { createClient } from '@/lib/supabase/server';
import { ReportResponse } from './types';

export interface FinSightReport {
  id: string;
  request_hash: string;
  report_type: 'single' | 'comparison' | 'portfolio';
  assets_json: string[];
  status: 'queued' | 'running' | 'done' | 'failed';
  content_json?: any;
  metadata_json?: any;
  created_at: string;
  updated_at: string;
}

export class FinSightReportsRepository {
  private supabase = createClient();

  /**
   * Find a report by its request hash
   */
  async findByHash(requestHash: string): Promise<FinSightReport | null> {
    const { data, error } = await this.supabase
      .from('finsight_reports')
      .select('*')
      .eq('request_hash', requestHash)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to find report by hash: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new report in queued status
   */
  async createQueued(params: {
    requestHash: string;
    reportType: 'single' | 'comparison' | 'portfolio';
    assets: string[];
  }): Promise<FinSightReport> {
    const { data, error } = await this.supabase
      .from('finsight_reports')
      .insert({
        request_hash: params.requestHash,
        report_type: params.reportType,
        assets_json: params.assets,
        status: 'queued',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create queued report: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark a report as running
   */
  async markRunning(id: string): Promise<FinSightReport> {
    const { data, error } = await this.supabase
      .from('finsight_reports')
      .update({
        status: 'running',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark report as running: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark a report as done with content
   */
  async markDone(id: string, content: any, metadata?: any): Promise<FinSightReport> {
    const updateData: any = {
      status: 'done',
      content_json: content,
      updated_at: new Date().toISOString(),
    };

    if (metadata) {
      updateData.metadata_json = metadata;
    }

    const { data, error } = await this.supabase
      .from('finsight_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark report as done: ${error.message}`);
    }

    return data;
  }

  /**
   * Mark a report as failed
   */
  async markFailed(id: string, errorMessage?: string): Promise<FinSightReport> {
    const updateData: any = {
      status: 'failed',
      updated_at: new Date().toISOString(),
    };

    if (errorMessage) {
      updateData.metadata_json = { error: errorMessage };
    }

    const { data, error } = await this.supabase
      .from('finsight_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark report as failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a report by ID
   */
  async getById(id: string): Promise<FinSightReport | null> {
    const { data, error } = await this.supabase
      .from('finsight_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to get report by ID: ${error.message}`);
    }

    return data;
  }

  /**
   * Convert database record to API response format
   */
  toReportResponse(report: FinSightReport): ReportResponse {
    return {
      id: report.id,
      status: report.status,
      requestHash: report.request_hash,
      reportType: report.report_type,
      assets: report.assets_json,
      content: report.content_json,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    };
  }
}

// Export singleton instance
export const finsightReportsRepo = new FinSightReportsRepository();