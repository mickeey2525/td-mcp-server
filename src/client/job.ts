import { Config, Job, JobList, JobApiError, TDSite } from '../types';
import { maskApiKey } from '../config';

/**
 * Mapping of Treasure Data sites to their Job API endpoints
 */
const JOB_ENDPOINTS: Record<TDSite, string> = {
  us01: 'https://api.treasuredata.com',
  jp01: 'https://api.treasuredata.co.jp',
  eu01: 'https://api.eu01.treasuredata.com',
  ap02: 'https://api.ap02.treasuredata.com',
  ap03: 'https://api.ap03.treasuredata.com',
  dev: 'https://api-development.treasuredata.com',
} as const;

/**
 * Client for interacting with Treasure Data Job API
 */
export class TDJobClient {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(config: Config) {
    this.apiKey = config.td_api_key;
    const endpoint = JOB_ENDPOINTS[config.site];
    
    if (!endpoint) {
      throw new Error(`Unknown TD site: ${config.site}`);
    }
    
    this.endpoint = endpoint;
  }

  private async request<T>(
    method: string,
    path: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    const url = new URL(`${this.endpoint}${path}`);
    
    // Add query parameters if provided
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    
    const headers: Record<string, string> = {
      'Authorization': `TD1 ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Job API Error: HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage += ` - ${errorJson.message || errorJson.error || errorBody}`;
        } catch {
          errorMessage += ` - ${errorBody}`;
        }

        const error = new Error(errorMessage) as JobApiError;
        error.statusCode = response.status;
        error.responseBody = errorBody;
        throw error;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        // Mask API key in error messages
        error.message = error.message.replace(this.apiKey, maskApiKey(this.apiKey));
      }
      throw error;
    }
  }

  /**
   * Lists jobs with optional filtering parameters
   * @param params Optional parameters for filtering jobs
   * @returns Promise resolving to job list
   */
  async listJobs(params?: {
    from?: number;
    to?: number;
    status?: string;
    conditions?: string;
    skip?: number;
    limit?: number;
  }): Promise<JobList> {
    const queryParams: Record<string, string | number> = {};
    
    if (params?.from) queryParams.from = params.from;
    if (params?.to) queryParams.to = params.to;
    if (params?.status) queryParams.status = params.status;
    if (params?.conditions) queryParams.conditions = params.conditions;
    if (params?.skip) queryParams.skip = params.skip;
    if (params?.limit) queryParams.limit = params.limit;

    return await this.request<JobList>('GET', '/v3/job/list', queryParams);
  }

  /**
   * Gets detailed information about a specific job
   * @param jobId The job ID to retrieve
   * @returns Promise resolving to job details
   */
  async getJob(jobId: string): Promise<Job> {
    return await this.request<Job>('GET', `/v3/job/show/${jobId}`);
  }

  /**
   * Gets the status of a specific job
   * @param jobId The job ID to check status for
   * @returns Promise resolving to job details with status
   */
  async getJobStatus(jobId: string): Promise<Job> {
    return await this.request<Job>('GET', `/v3/job/status/${jobId}`);
  }

  /**
   * Gets job status by domain key
   * @param domainKey The domain key to check status for
   * @returns Promise resolving to job details
   */
  async getJobStatusByDomainKey(domainKey: string): Promise<Job> {
    return await this.request<Job>('GET', `/v3/job/status_by_domain_key/${domainKey}`);
  }
}

export function createJobClient(config: Config): TDJobClient {
  return new TDJobClient(config);
}