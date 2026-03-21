/**
 * Edge Function Monitor
 *
 * Monitors Supabase Edge Function performance and errors.
 */

interface FunctionMetrics {
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  successCount: number;
  errorCount: number;
  lastError?: string;
  lastErrorTime?: string;
}

interface FunctionAlert {
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric?: string;
  threshold?: number;
  actual?: number;
}

interface EdgeFunctionResult {
  functionName?: string;
  metrics: FunctionMetrics;
  alerts: FunctionAlert[];
  recommendation: string;
  timeRange: string;
}

export async function monitorEdgeFunctions(input: {
  functionName?: string;
  timeRange?: '1h' | '24h' | '7d';
  limit?: number;
}): Promise<EdgeFunctionResult> {
  const { functionName, timeRange = '24h', limit = 100 } = input;

  try {
    // Mock data simulation - in production would query Supabase logs
    // This demonstrates the structure and expected output

    const timeRangeMap = {
      '1h': 60,
      '24h': 1440,
      '7d': 10080,
    };

    const minutes = timeRangeMap[timeRange];

    // Simulated metrics based on function name
    let baseLatency = 150;
    let errorRate = 0.02;
    const successCount = 500;

    if (functionName === 'calculate-freight') {
      baseLatency = 200; // heavier function
      errorRate = 0.01;
    } else if (functionName === 'notification-hub') {
      baseLatency = 100; // lighter function
      errorRate = 0.005;
    }

    const metrics: FunctionMetrics = {
      avgLatency: baseLatency,
      p95Latency: Math.round(baseLatency * 1.5),
      p99Latency: Math.round(baseLatency * 2.0),
      errorRate: errorRate * 100,
      successCount: Math.round(successCount * (minutes / 1440)), // Scale to time range
      errorCount: Math.round((successCount * (minutes / 1440) * errorRate) / (1 - errorRate)),
      lastError: errorRate > 0 ? 'CALL_ERROR: Function timed out' : undefined,
      lastErrorTime: errorRate > 0 ? new Date(Date.now() - 3600000).toISOString() : undefined,
    };

    const alerts: FunctionAlert[] = [];

    // Check latency thresholds
    if (metrics.avgLatency > 250) {
      alerts.push({
        severity: 'warning',
        message: 'Edge Function latency is high',
        metric: 'avgLatency',
        threshold: 250,
        actual: metrics.avgLatency,
      });
    }

    if (metrics.p99Latency > 500) {
      alerts.push({
        severity: 'critical',
        message: 'P99 latency exceeds 500ms - affects user experience',
        metric: 'p99Latency',
        threshold: 500,
        actual: metrics.p99Latency,
      });
    }

    // Check error rate
    if (metrics.errorRate > 1) {
      alerts.push({
        severity: 'critical',
        message: 'Error rate is above 1%',
        metric: 'errorRate',
        threshold: 1,
        actual: metrics.errorRate,
      });
    } else if (metrics.errorRate > 0.5) {
      alerts.push({
        severity: 'warning',
        message: 'Error rate is elevated',
        metric: 'errorRate',
        threshold: 0.5,
        actual: metrics.errorRate,
      });
    }

    // Generate recommendation
    let recommendation = '✅ Edge Function is performing well';

    if (alerts.some((a) => a.severity === 'critical')) {
      recommendation =
        '⚠️ CRITICAL: Review function code for errors. Check Edge Function logs in Supabase dashboard.';
    } else if (alerts.some((a) => a.severity === 'warning')) {
      if (metrics.avgLatency > 250) {
        recommendation += '\n- Consider optimizing database queries or reducing payload size.';
      }
      if (metrics.errorRate > 0.5) {
        recommendation += '\n- Investigate recent error patterns in logs.';
      }
    }

    return {
      functionName,
      metrics,
      alerts,
      recommendation,
      timeRange,
    };
  } catch (error) {
    throw new Error(
      `Failed to monitor Edge Function: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
