/**
 * Insurance Monitoring Hooks
 * Phase E - Bloco 3: Dashboard Metrics
 *
 * Hooks customizados que consomem as views SQL de insurance_logs
 * e retornam dados tipados para o dashboard.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Volume Metrics
 */
export interface VolumeMetric {
  time_bucket: string; // ISO timestamp (5 min interval) - derived from bucket_5m in the view
  requests_total: number;
  success_count: number;
  error_count: number;
  timeout_count: number;
  rate_limit_count: number;
  fallback_count: number;
  success_rate: number; // 0-1, calculated
}

export function useInsuranceVolumeMetrics(
  timeRange: '1h' | '24h' | '7d' = '24h'
): UseQueryResult<VolumeMetric[], Error> {
  return useQuery({
    queryKey: ['insurance-volume-metrics', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_metrics_volume')
        .select(
          `
          bucket_5m,
          requests_total,
          success_count,
          error_count,
          timeout_count,
          rate_limit_count,
          fallback_count
        `
        )
        .gte('bucket_5m', new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString())
        .order('bucket_5m', { ascending: true });

      if (error) throw error;

      // Map bucket_5m -> time_bucket and calculate success_rate
      return (data || []).map(
        (row: {
          bucket_5m: string;
          requests_total: number;
          success_count: number;
          error_count: number;
          timeout_count: number;
          rate_limit_count: number;
          fallback_count: number;
        }) => ({
          time_bucket: row.bucket_5m,
          requests_total: row.requests_total,
          success_count: row.success_count,
          error_count: row.error_count,
          timeout_count: row.timeout_count,
          rate_limit_count: row.rate_limit_count,
          fallback_count: row.fallback_count,
          success_rate: row.requests_total > 0 ? row.success_count / row.requests_total : 0,
        })
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Latency Metrics (P50, P95, P99)
 */
export interface LatencyMetric {
  time_bucket: string; // ISO timestamp (5 min interval) - derived from bucket_5m in the view
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export function useInsuranceLatencyMetrics(
  timeRange: '1h' | '24h' | '7d' = '24h'
): UseQueryResult<LatencyMetric[], Error> {
  return useQuery({
    queryKey: ['insurance-latency-metrics', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_metrics_latency')
        .select(
          `
          bucket_5m,
          p50_ms,
          p95_ms,
          p99_ms
        `
        )
        .gte('bucket_5m', new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString())
        .order('bucket_5m', { ascending: true });

      if (error) throw error;
      // Map bucket_5m -> time_bucket
      return (data || []).map(
        (row: { bucket_5m: string; p50_ms: number; p95_ms: number; p99_ms: number }) => ({
          time_bucket: row.bucket_5m,
          p50_ms: row.p50_ms,
          p95_ms: row.p95_ms,
          p99_ms: row.p99_ms,
        })
      );
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Error Breakdown
 */
export interface ErrorBreakdownMetric {
  status: 'success' | 'error' | 'timeout' | 'rate_limit' | 'fallback';
  count: number;
  percentage: number; // 0-100
}

export function useInsuranceErrorBreakdown(
  timeRange: '1h' | '24h' | '7d' = '24h'
): UseQueryResult<ErrorBreakdownMetric[], Error> {
  return useQuery({
    queryKey: ['insurance-error-breakdown', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_logs')
        .select('status')
        .gte('created_at', new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString());

      if (error) throw error;

      // Aggregate by status
      const breakdown = {
        success: 0,
        error: 0,
        timeout: 0,
        rate_limit: 0,
        fallback: 0,
      };

      (data || []).forEach((log) => {
        const status = log.status as keyof typeof breakdown;
        if (status in breakdown) {
          breakdown[status]++;
        }
      });

      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

      return Object.entries(breakdown)
        .map(([status, count]) => ({
          status: status as ErrorBreakdownMetric['status'],
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        }))
        .filter((item) => item.count > 0); // Only show statuses with data
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Fallback Ratio with Alert Thresholds
 */
export interface FallbackMetric {
  total_requests: number;
  fallback_count: number;
  fallback_ratio: number; // 0-1
  alert_level: 'green' | 'yellow' | 'red'; // green: <10%, yellow: 10-20%, red: >20%
}

export function useInsuranceFallbackRatio(
  timeRange: '30m' | '1h' | '24h' = '1h'
): UseQueryResult<FallbackMetric, Error> {
  return useQuery({
    queryKey: ['insurance-fallback-ratio', timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_logs')
        .select('fallback_used')
        .gte(
          'created_at',
          new Date(Date.now() - getTimeRangeMs(timeRange as '30m' | '1h' | '24h')).toISOString()
        );

      if (error) throw error;

      const total = data?.length || 0;
      const fallbackCount = (data || []).filter((log) => log.fallback_used).length;
      const ratio = total > 0 ? fallbackCount / total : 0;

      let alertLevel: 'green' | 'yellow' | 'red' = 'green';
      if (ratio > 0.2) alertLevel = 'red';
      else if (ratio > 0.1) alertLevel = 'yellow';

      return {
        total_requests: total,
        fallback_count: fallbackCount,
        fallback_ratio: ratio,
        alert_level: alertLevel,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Current Status Summary (últimos 30 min)
 */
export interface StatusSummary {
  uptime_percentage: number; // success_rate * 100
  avg_latency_ms: number;
  fallback_ratio: number;
  error_rate: number;
  last_check_at: string;
}

export function useInsuranceStatusSummary(): UseQueryResult<StatusSummary, Error> {
  return useQuery({
    queryKey: ['insurance-status-summary'],
    queryFn: async () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('insurance_logs')
        .select('status, duration_ms, fallback_used, created_at')
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const logs = data || [];
      const total = logs.length;

      if (total === 0) {
        return {
          uptime_percentage: 100,
          avg_latency_ms: 0,
          fallback_ratio: 0,
          error_rate: 0,
          last_check_at: new Date().toISOString(),
        };
      }

      const successCount = logs.filter((log) => log.status === 'success').length;
      const errorCount = logs.filter((log) => log.status === 'error').length;
      const fallbackCount = logs.filter((log) => log.fallback_used).length;
      const avgLatency = logs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / total;
      const lastCheck = logs[0]?.created_at || new Date().toISOString();

      return {
        uptime_percentage: (successCount / total) * 100,
        avg_latency_ms: Math.round(avgLatency),
        fallback_ratio: fallbackCount / total,
        error_rate: (errorCount / total) * 100,
        last_check_at: lastCheck,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (mais fresco que os others)
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Helper: Convert time range string to milliseconds
 */
function getTimeRangeMs(timeRange: '30m' | '1h' | '24h' | '7d'): number {
  switch (timeRange) {
    case '30m':
      return 30 * 60 * 1000;
    case '1h':
      return 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
