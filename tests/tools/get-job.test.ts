import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetJob } from '../../src/tools/get-job';
import { createJobClient } from '../../src/client/job';
import { Config } from '../../src/types';

// Mock the job client
vi.mock('../../src/client/job');

const mockConfig: Config = {
  td_api_key: 'test-key',
  site: 'us01',
};

describe('handleGetJob', () => {
  const mockJobClient = {
    getJob: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createJobClient).mockReturnValue(mockJobClient as any);
  });

  it('should get job details successfully', async () => {
    const mockJob = {
      job_id: 'job123',
      type: 'presto',
      status: 'success',
      database: 'test_db',
      query: 'SELECT * FROM users WHERE created_at > \'2024-01-01\'',
      url: 'https://console.treasuredata.com/jobs/job123',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:05:00Z',
      start_at: '2024-01-01T10:01:00Z',
      end_at: '2024-01-01T10:04:00Z',
      num_records: 1500,
      priority: 0,
      retry_limit: 3,
      result: 'gs://td-result-bucket/job123/result.csv',
      organization: 'test-org',
    };

    mockJobClient.getJob.mockResolvedValue(mockJob);

    const result = await handleGetJob({ job_id: 'job123' }, mockConfig);

    expect(createJobClient).toHaveBeenCalledWith(mockConfig);
    expect(mockJobClient.getJob).toHaveBeenCalledWith('job123');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Job Details:');
    expect(result.content[0].text).toContain('job123');
    expect(result.content[0].text).toContain('SELECT * FROM users');
    expect(result.content[0].text).toContain('execution_time_seconds": 180'); // 3 minutes
  });

  it('should include debug information when available', async () => {
    const mockJob = {
      job_id: 'job456',
      type: 'presto',
      status: 'error',
      database: 'test_db',
      query: 'SELECT * FROM nonexistent_table',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:02:00Z',
      start_at: '2024-01-01T10:01:00Z',
      end_at: '2024-01-01T10:02:00Z',
      debug: {
        stderr: 'line 1:15: Table \'test_db.nonexistent_table\' does not exist',
        cmdout: 'Query compilation failed',
      },
    };

    mockJobClient.getJob.mockResolvedValue(mockJob);

    const result = await handleGetJob({ job_id: 'job456' }, mockConfig);

    expect(result.content[0].text).toContain('Job Details:');
    expect(result.content[0].text).toContain('error_message');
    expect(result.content[0].text).toContain('Table \'test_db.nonexistent_table\' does not exist');
    expect(result.content[0].text).toContain('Query compilation failed');
  });

  it('should handle running jobs without end_at', async () => {
    const mockJob = {
      job_id: 'job789',
      type: 'presto',
      status: 'running',
      database: 'test_db',
      query: 'SELECT COUNT(*) FROM large_table',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:30:00Z',
      start_at: '2024-01-01T10:01:00Z',
      // No end_at for running job
      priority: 1,
      retry_limit: 0,
    };

    mockJobClient.getJob.mockResolvedValue(mockJob);

    const result = await handleGetJob({ job_id: 'job789' }, mockConfig);

    expect(result.content[0].text).toContain('Job Details:');
    expect(result.content[0].text).toContain('running');
    expect(result.content[0].text).not.toContain('execution_time_seconds');
    expect(result.content[0].text).toContain('SELECT COUNT(*) FROM large_table');
  });

  it('should handle jobs with minimal information', async () => {
    const mockJob = {
      job_id: 'job999',
      type: 'hive',
      status: 'queued',
      query: 'SELECT 1',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
      // Minimal fields
    };

    mockJobClient.getJob.mockResolvedValue(mockJob);

    const result = await handleGetJob({ job_id: 'job999' }, mockConfig);

    expect(result.content[0].text).toContain('Job Details:');
    expect(result.content[0].text).toContain('job999');
    expect(result.content[0].text).toContain('queued');
    expect(result.content[0].text).toContain('SELECT 1');
  });

  it('should handle API errors', async () => {
    const error = new Error('API Error: HTTP 403 - Access denied');
    mockJobClient.getJob.mockRejectedValue(error);

    const result = await handleGetJob({ job_id: 'restricted_job' }, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting job details: API Error: HTTP 403 - Access denied');
  });

  it('should validate required job_id parameter', async () => {
    const result = await handleGetJob({}, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error getting job details');
    expect(result.content[0].text).toContain('Required');
  });

  it('should handle job with only stderr debug info', async () => {
    const mockJob = {
      job_id: 'job555',
      type: 'presto',
      status: 'error',
      query: 'INVALID SQL SYNTAX',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:01:00Z',
      debug: {
        stderr: 'Syntax error at line 1:1',
        // No cmdout
      },
    };

    mockJobClient.getJob.mockResolvedValue(mockJob);

    const result = await handleGetJob({ job_id: 'job555' }, mockConfig);

    expect(result.content[0].text).toContain('Job Details:');
    expect(result.content[0].text).toContain('Syntax error at line 1:1');
    expect(result.content[0].text).not.toContain('output');
  });
});