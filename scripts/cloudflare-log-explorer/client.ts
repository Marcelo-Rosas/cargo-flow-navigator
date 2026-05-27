import type { CloudflareApiResponse, LogExplorerDatasetSummary } from './types.ts';

const API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareLogExplorerClient {
  constructor(private readonly apiToken: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<CloudflareApiResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const raw = await res.text();
    let body: CloudflareApiResponse<T>;
    try {
      body = JSON.parse(raw) as CloudflareApiResponse<T>;
    } catch {
      const snippet = raw.trim().slice(0, 200) || `HTTP ${res.status}`;
      throw new Error(`${res.status}: ${snippet}`);
    }

    if (!res.ok && body.success !== true) {
      const msg =
        body.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return body;
  }

  async listZones(perPage = 50): Promise<Array<{ id: string; name: string }>> {
    const { result } = await this.request<Array<{ id: string; name: string }>>(
      `/zones?per_page=${perPage}`
    );
    return result ?? [];
  }

  async listAccountDatasets(
    accountId: string,
    includeZones = true
  ): Promise<LogExplorerDatasetSummary[]> {
    const qs = includeZones ? '?include_zones=true' : '';
    const { result } = await this.request<LogExplorerDatasetSummary[]>(
      `/accounts/${accountId}/logs/explorer/datasets${qs}`
    );
    return result ?? [];
  }

  async listZoneDatasets(zoneId: string): Promise<LogExplorerDatasetSummary[]> {
    const { result } = await this.request<LogExplorerDatasetSummary[]>(
      `/zones/${zoneId}/logs/explorer/datasets`
    );
    return result ?? [];
  }

  async listAvailableAccountDatasets(accountId: string): Promise<string[]> {
    const { result } = await this.request<Array<{ dataset?: string; name?: string }>>(
      `/accounts/${accountId}/logs/explorer/datasets/available`
    );
    return (result ?? []).map((r) => r.dataset ?? r.name ?? '').filter(Boolean);
  }

  async listAvailableZoneDatasets(zoneId: string): Promise<string[]> {
    const { result } = await this.request<Array<{ dataset?: string; name?: string }>>(
      `/zones/${zoneId}/logs/explorer/datasets/available`
    );
    return (result ?? []).map((r) => r.dataset ?? r.name ?? '').filter(Boolean);
  }

  async createAccountDataset(
    accountId: string,
    dataset: string
  ): Promise<LogExplorerDatasetSummary> {
    const { result } = await this.request<LogExplorerDatasetSummary>(
      `/accounts/${accountId}/logs/explorer/datasets`,
      {
        method: 'POST',
        body: JSON.stringify({ dataset }),
      }
    );
    if (!result) throw new Error(`Empty result creating account dataset ${dataset}`);
    return result;
  }

  async createZoneDataset(zoneId: string, dataset: string): Promise<LogExplorerDatasetSummary> {
    const { result } = await this.request<LogExplorerDatasetSummary>(
      `/zones/${zoneId}/logs/explorer/datasets`,
      {
        method: 'POST',
        body: JSON.stringify({ dataset }),
      }
    );
    if (!result) throw new Error(`Empty result creating zone dataset ${dataset}`);
    return result;
  }
}

/** 409 = dataset já existe para account/zone */
export function isAlreadyExistsError(message: string): boolean {
  return /409|already exists|duplicate/i.test(message);
}

export type FailureKind = 'unsupported' | 'internal' | 'auth' | 'unknown';

export function classifyFailure(message: string): FailureKind {
  if (/unsupported dataset|400.*unsupported/i.test(message)) return 'unsupported';
  if (/internal error|500|502|503|504/i.test(message)) return 'internal';
  if (/403|401|9106|authentication|permission|unauthorized/i.test(message)) return 'auth';
  return 'unknown';
}
