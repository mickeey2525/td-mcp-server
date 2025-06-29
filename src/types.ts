export interface Config {
  td_api_key: string;
  site: 'us01' | 'jp01' | 'eu01' | 'ap02' | 'ap03' | 'dev';
  enable_updates?: boolean;
  database?: string;
  llm_api_base?: string;
  default_project_name?: string;
  default_agent_id?: string;
}

export interface QueryResult {
  columns: Array<{
    name: string;
    type: string;
  }>;
  data: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface ExecuteResult {
  affectedRows: number;
  success: boolean;
  message?: string;
}

export type TDSite = Config['site'];

export interface TableInfo {
  database: string;
  table: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

export interface Job {
  job_id: string;
  type: string;
  url: string;
  query: string;
  status: 'queued' | 'booting' | 'running' | 'success' | 'error' | 'killed';
  created_at: string;
  updated_at: string;
  start_at?: string;
  end_at?: string;
  num_records?: number;
  database?: string;
  retry_limit?: number;
  priority?: number;
  result?: string;
  organization?: string;
  debug?: {
    cmdout?: string;
    stderr?: string;
  };
}

export interface JobList {
  count: number;
  from?: string;
  to?: string;
  jobs: Job[];
}

export interface JobApiError extends Error {
  statusCode?: number;
  responseBody?: string;
}