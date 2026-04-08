// @ts-nocheck
/**
 * mirofish-sync — Sync market intelligence from MiroFish into CFN Supabase.
 *
 * Flow:
 *   1. GET MiroFish /api/report/list → find reports not yet synced
 *   2. GET /api/report/<id>/insights/structured → typed JSON
 *   3. Upsert into mirofish_reports, mirofish_route_insights,
 *      mirofish_shipper_insights, mirofish_recommendations
 *   4. For high-priority recommendations → fire Paperclip webhook
 *
 * Env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   MIROFISH_API_URL  (e.g. https://mirofish.vectracargo.com.br or http://your-ngrok/api)
 *   MIROFISH_API_KEY  (optional bearer token)
 *   PAPERCLIP_WEBHOOK_URL  (webhook URL for cadencia-lead-quente routine)
 *   PAPERCLIP_WEBHOOK_SECRET
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MIROFISH_API_URL = (Deno.env.get('MIROFISH_API_URL') ?? '').replace(/\/$/, '');
const MIROFISH_API_KEY = Deno.env.get('MIROFISH_API_KEY') ?? '';
const PAPERCLIP_WEBHOOK_URL = Deno.env.get('PAPERCLIP_WEBHOOK_URL') ?? '';
const PAPERCLIP_WEBHOOK_SECRET = Deno.env.get('PAPERCLIP_WEBHOOK_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function miroFishHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (MIROFISH_API_KEY) headers['Authorization'] = `Bearer ${MIROFISH_API_KEY}`;
  return headers;
}

async function miroFishFetch(path: string) {
  const res = await fetch(`${MIROFISH_API_URL}${path}`, { headers: miroFishHeaders() });
  if (!res.ok) throw new Error(`MiroFish ${path} → ${res.status}`);
  return res.json();
}

async function firePaperclipWebhook(payload: unknown) {
  if (!PAPERCLIP_WEBHOOK_URL || !PAPERCLIP_WEBHOOK_SECRET) return;
  await fetch(PAPERCLIP_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PAPERCLIP_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(payload),
  });
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!MIROFISH_API_URL) {
      return new Response(JSON.stringify({ error: 'MIROFISH_API_URL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. List recent MiroFish reports
    const listData = await miroFishFetch('/api/report/list?limit=10');
    const reports: any[] = listData.data ?? [];

    // 2. Find which report IDs are already synced
    const miroIds = reports.map((r: any) => r.report_id);
    const { data: existing } = await supabase
      .from('mirofish_reports')
      .select('mirofish_report_id')
      .in('mirofish_report_id', miroIds);
    const existingIds = new Set((existing ?? []).map((r: any) => r.mirofish_report_id));

    const newReports = reports.filter((r: any) => !existingIds.has(r.report_id));
    let synced = 0;
    let highPriorityCount = 0;

    for (const report of newReports) {
      // 3. Fetch structured insights
      let insightsData: any;
      try {
        const resp = await miroFishFetch(`/api/report/${report.report_id}/insights/structured`);
        insightsData = resp.data;
      } catch {
        continue; // insights not yet computed for this report
      }

      if (!insightsData?.insights) continue;

      const insights = insightsData.insights;

      // 4. Upsert mirofish_reports
      const { data: reportRow, error: reportErr } = await supabase
        .from('mirofish_reports')
        .upsert(
          {
            mirofish_report_id: report.report_id,
            simulation_id: report.simulation_id ?? insightsData.simulation_id,
            title: report.title ?? null,
            generated_at: insightsData.generated_at ?? null,
            raw_insights: insights,
          },
          { onConflict: 'mirofish_report_id' }
        )
        .select('id')
        .single();

      if (reportErr || !reportRow) continue;
      const reportUUID = reportRow.id;

      // 5. Upsert route insights
      if (insights.route_performance?.length) {
        await supabase.from('mirofish_route_insights').insert(
          insights.route_performance.map((r: any) => ({
            report_id: reportUUID,
            route: r.route,
            avg_ticket: r.avg_ticket ?? null,
            volume_ctes: r.volume_ctes ?? null,
            revenue: r.revenue ?? null,
            avg_weight_kg: r.avg_weight_kg ?? null,
            ntc_impact: r.ntc_impact ?? null,
          }))
        );
      }

      // 6. Upsert shipper insights
      if (insights.shipper_profiles?.length) {
        await supabase.from('mirofish_shipper_insights').insert(
          insights.shipper_profiles.map((s: any) => ({
            report_id: reportUUID,
            shipper_name: s.name,
            ctes: s.ctes ?? null,
            revenue: s.revenue ?? null,
            avg_ticket: s.avg_ticket ?? null,
            routes_count: s.routes_count ?? null,
            churn_risk: ['low', 'medium', 'high'].includes(s.churn_risk) ? s.churn_risk : null,
          }))
        );
      }

      // 7. Insert recommendations and fire Paperclip for high-priority ones
      if (insights.recommendations?.length) {
        const recs = insights.recommendations.map((rec: any) => ({
          report_id: reportUUID,
          action: rec.action,
          priority: ['low', 'medium', 'high'].includes(rec.priority) ? rec.priority : 'medium',
          target_routes: rec.target_routes ?? null,
          status: 'pending',
        }));
        await supabase.from('mirofish_recommendations').insert(recs);

        const highPriority = insights.recommendations.filter((r: any) => r.priority === 'high');
        if (highPriority.length > 0) {
          highPriorityCount += highPriority.length;
          await firePaperclipWebhook({
            source: 'mirofish-sync',
            report_id: report.report_id,
            high_priority_recommendations: highPriority,
            synced_at: new Date().toISOString(),
          });
        }
      }

      synced++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reports_found: reports.length,
        reports_synced: synced,
        high_priority_triggered: highPriorityCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('mirofish-sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
