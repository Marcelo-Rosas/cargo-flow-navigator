export type LogExplorerScope = 'account' | 'zone';

export interface LogExplorerDatasetSpec {
  dataset: string;
  scope: LogExplorerScope;
  priority: 'critical' | 'high' | 'optional';
  service: string;
  justification: string;
}

export interface LogExplorerDatasetSummary {
  dataset: string;
  dataset_id: string;
  object_type: 'account' | 'zone';
  object_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CloudflareApiResponse<T> {
  success: boolean;
  result: T;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
}

export interface ProvisionResult {
  dataset: string;
  scope: LogExplorerScope;
  status: 'created' | 'skipped' | 'failed';
  message: string;
}
