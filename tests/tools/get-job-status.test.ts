import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetJobStatus } from '../../src/tools/get-job-status';
import { createJobClient } from '../../src/client/job';
import { Config } from '../../src/types';

// Mock the job client
vi.mock('../../src/client/job');

const mockConfig: Config = {
  td_api_key: 'test-key',
  site: 'us01',
};

describe('handleGetJobStatus', () => {
  const mockJobClient = {
    getJobStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createJobClient).mockReturnValue(mockJobClient as any);
  });

  it('should get job status successfully', async () => {
    const mockJob = {
      job_id: 'job123',
      type: 'presto',
      status: 'success',
      database: 'test_db',
      query: 'SELECT * FROM table',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:05:00Z',
      start_at: '2024-01-01T10:01:00Z',
      end_at: '2024-01-01T10:04:00Z',
      num_records: 100,
      organization: 'test-org',
    };

    mockJobClient.getJobStatus.mockResolvedValue(mockJob);

    const result = await handleGetJobStatus({ job_id: 'job123' }, mockConfig);

    expect(createJobClient).toHaveBeenCalledWith(mockConfig);
    expect(mockJobClient.getJobStatus).toHaveBeenCalledWith('job123');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Job Status: SUCCESS');
    expect(result.content[0].text).toContain('job123');
    expect(result.content[0].text).toContain('execution_time_seconds');
  });

  it('should include error message when job failed', async () => {
    const mockJob = {
      job_id: 'job456',
      type: 'presto',
      status: 'error',
      database: 'test_db',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:05:00Z',
      debug: {
        stderr: 'Table not found: invalid_table',
        cmdout: 'Query execution failed',
      },
    };

    mockJobClient.getJobStatus.mockResolvedValue(mockJob);

    const result = await handleGetJobStatus({ job_id: 'job456' }, mockConfig);

    expect(result.content[0].text).toContain('Job Status: ERROR');
    expect(result.content[0].text).toContain('Table not found: invalid_table');
    expect(result.content[0].text).toContain('Query execution failed');
  });

  it('should include full details when requested', async () => {
    const mockJob = {
      job_id: 'job789',
      type: 'presto',
      status: 'running',
      database: 'test_db',
      query: 'SELECT COUNT(*) FROM large_table',
      url: 'https://console.treasuredata.com/jobs/job789',
      priority: 1,
      retry_limit: 3,
      result: 'partial_results',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:05:00Z',
      debug: {
        cmdout: 'Processing...',
      },
    };

    mockJobClient.getJobStatus.mockResolvedValue(mockJob);

    const result = await handleGetJobStatus(
      { job_id: 'job789', include_details: true },
      mockConfig
    );

    expect(result.content[0].text).toContain('Job Status: RUNNING');
    expect(result.content[0].text).toContain('SELECT COUNT(*) FROM large_table');
    expect(result.content[0].text).toContain('https://console.treasuredata.com/jobs/job789');
    expect(result.content[0].text).toContain('priority');
    expect(result.content[0].text).toContain('retry_limit');
    expect(result.content[0].text).toContain('partial_results');
  });

  it('should calculate execution time correctly', async () => {
    const mockJob = {
      job_id: 'job999',
      type: 'presto',
      status: 'success',
      start_at: '2024-01-01T10:00:00Z',
      end_at: '2024-01-01T10:02:30Z', // 2.5 minutes = 150 seconds
      created_at: '2024-01-01T09:59:00Z',
      updated_at: '2024-01-01T10:02:30Z',
    };

    mockJobClient.getJobStatus.mockResolvedValue(mockJob);

    const result = await handleGetJobStatus({ job_id: 'job999' }, mockConfig);

    expect(result.content[0].text).toContain('execution_time_seconds": 150');
  });

  it('should handle API errors', async () => {
    const error = new Error('API Error: HTTP 404 - Job not found');
    mockJobClient.getJobStatus.mockRejectedValue(error);

    const result = await handleGetJobStatus({ job_id: 'nonexistent' }, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting job status: API Error: HTTP 404 - Job not found');
  });

  it('should validate required job_id parameter', async () => {
    const result = await handleGetJobStatus({}, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting job status');
    expect(result.content[0].text).toContain('Required');
  });

  it('should handle missing start_at or end_at gracefully', async () => {
    const mockJob = {
      job_id: 'job111',
      type: 'presto',
      status: 'queued',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      // No start_at or end_at
    };

    mockJobClient.getJobStatus.mockResolvedValue(mockJob);

    const result = await handleGetJobStatus({ job_id: 'job111' }, mockConfig);

    expect(result.content[0].text).toContain('Job Status: QUEUED');
    expect(result.content[0].text).not.toContain('execution_time_seconds');
  });
});