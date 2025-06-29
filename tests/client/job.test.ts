import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TDJobClient, createJobClient } from '../../src/client/job';
import { Config } from '../../src/types';

// Mock fetch
global.fetch = vi.fn();

const mockConfig: Config = {
  td_api_key: 'test-api-key-12345',
  site: 'us01',
};

describe('TDJobClient', () => {
  let client: TDJobClient;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.clearAllMocks();
    client = new TDJobClient(mockConfig);
  });

  describe('constructor', () => {
    it('should create client with correct endpoint for us01', () => {
      const client = new TDJobClient({ ...mockConfig, site: 'us01' });
      expect(client).toBeInstanceOf(TDJobClient);
    });

    it('should create client with correct endpoint for jp01', () => {
      const client = new TDJobClient({ ...mockConfig, site: 'jp01' });
      expect(client).toBeInstanceOf(TDJobClient);
    });

    it('should throw error for unknown site', () => {
      expect(() => {
        new TDJobClient({ ...mockConfig, site: 'unknown' as any });
      }).toThrow('Unknown TD site: unknown');
    });
  });

  describe('listJobs', () => {
    it('should make correct API call for listing jobs', async () => {
      const mockResponse = {
        count: 1,
        jobs: [
          {
            job_id: 'job123',
            type: 'presto',
            status: 'success',
            query: 'SELECT * FROM table',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.listJobs();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.treasuredata.com/v3/job/list',
        {
          method: 'GET',
          headers: {
            'Authorization': 'TD1 test-api-key-12345',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include query parameters when provided', async () => {
      const mockResponse = { count: 0, jobs: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.listJobs({
        status: 'running',
        limit: 10,
        from: 1704110400,
        to: 1704196800,
      });

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('https://api.treasuredata.com/v3/job/list');
      expect(call[0]).toContain('status=running');
      expect(call[0]).toContain('limit=10');
      expect(call[0]).toContain('from=1704110400');
      expect(call[0]).toContain('to=1704196800');
    });
  });

  describe('getJob', () => {
    it('should make correct API call for getting job details', async () => {
      const mockJob = {
        job_id: 'job123',
        type: 'presto',
        status: 'success',
        query: 'SELECT * FROM table',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockJob,
      } as Response);

      const result = await client.getJob('job123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.treasuredata.com/v3/job/show/job123',
        {
          method: 'GET',
          headers: {
            'Authorization': 'TD1 test-api-key-12345',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      expect(result).toEqual(mockJob);
    });
  });

  describe('getJobStatus', () => {
    it('should make correct API call for getting job status', async () => {
      const mockJob = {
        job_id: 'job123',
        status: 'running',
        type: 'presto',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockJob,
      } as Response);

      const result = await client.getJobStatus('job123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.treasuredata.com/v3/job/status/job123',
        {
          method: 'GET',
          headers: {
            'Authorization': 'TD1 test-api-key-12345',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      expect(result).toEqual(mockJob);
    });
  });

  describe('getJobStatusByDomainKey', () => {
    it('should make correct API call for getting job status by domain key', async () => {
      const mockJob = {
        job_id: 'job123',
        status: 'success',
        type: 'presto',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockJob,
      } as Response);

      const result = await client.getJobStatusByDomainKey('domain123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.treasuredata.com/v3/job/status_by_domain_key/domain123',
        {
          method: 'GET',
          headers: {
            'Authorization': 'TD1 test-api-key-12345',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );

      expect(result).toEqual(mockJob);
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors with JSON response', async () => {
      const errorResponse = {
        message: 'Job not found',
        error: 'NOT_FOUND',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify(errorResponse),
      } as Response);

      await expect(client.getJob('nonexistent')).rejects.toThrow(
        'Job API Error: HTTP 404 - Job not found'
      );
    });

    it('should handle HTTP errors with plain text response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      await expect(client.listJobs()).rejects.toThrow(
        'Job API Error: HTTP 500 - Internal Server Error'
      );
    });

    it('should mask API key in error messages', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Request failed with API key test-api-key-12345')
      );

      const error = await client.listJobs().catch(e => e);
      expect(error.message).toContain('Request failed with API key test');
      expect(error.message).not.toContain('test-api-key-12345');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.listJobs()).rejects.toThrow('Network error');
    });
  });
});

describe('createJobClient', () => {
  it('should create TDJobClient instance', () => {
    const client = createJobClient(mockConfig);
    expect(client).toBeInstanceOf(TDJobClient);
  });
});