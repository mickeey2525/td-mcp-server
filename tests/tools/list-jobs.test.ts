import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleListJobs } from '../../src/tools/list-jobs';
import { createJobClient } from '../../src/client/job';
import { Config } from '../../src/types';

// Mock the job client
vi.mock('../../src/client/job');

const mockConfig: Config = {
  td_api_key: 'test-key',
  site: 'us01',
};

describe('handleListJobs', () => {
  const mockJobClient = {
    listJobs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createJobClient).mockReturnValue(mockJobClient as any);
  });

  it('should list jobs successfully', async () => {
    const mockJobList = {
      count: 2,
      jobs: [
        {
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
          priority: 0,
          retry_limit: 0,
          organization: 'test-org',
        },
        {
          job_id: 'job456',
          type: 'hive',
          status: 'error',
          database: 'test_db',
          query: 'SELECT * FROM invalid_table',
          created_at: '2024-01-01T11:00:00Z',
          updated_at: '2024-01-01T11:02:00Z',
          debug: {
            stderr: 'Table not found: invalid_table',
          },
        },
      ],
    };

    mockJobClient.listJobs.mockResolvedValue(mockJobList);

    const result = await handleListJobs({}, mockConfig);

    expect(createJobClient).toHaveBeenCalledWith(mockConfig);
    expect(mockJobClient.listJobs).toHaveBeenCalledWith({});
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Found 2 jobs');
    expect(result.content[0].text).toContain('job123');
    expect(result.content[0].text).toContain('job456');
    expect(result.content[0].text).toContain('Table not found: invalid_table');
  });

  it('should handle filtering parameters', async () => {
    const mockJobList = {
      count: 1,
      jobs: [
        {
          job_id: 'job789',
          type: 'presto',
          status: 'running',
          database: 'test_db',
          query: 'SELECT COUNT(*) FROM large_table',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
        },
      ],
    };

    mockJobClient.listJobs.mockResolvedValue(mockJobList);

    const args = {
      status: 'running',
      limit: 10,
      from: 1704110400, // 2024-01-01T12:00:00Z
    };

    const result = await handleListJobs(args, mockConfig);

    expect(mockJobClient.listJobs).toHaveBeenCalledWith(args);
    expect(result.content[0].text).toContain('Found 1 jobs');
    expect(result.content[0].text).toContain('running');
  });

  it('should truncate long queries', async () => {
    const longQuery = 'SELECT ' + 'column, '.repeat(100) + 'other_column FROM table';
    const mockJobList = {
      count: 1,
      jobs: [
        {
          job_id: 'job999',
          type: 'presto',
          status: 'success',
          query: longQuery,
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:05:00Z',
        },
      ],
    };

    mockJobClient.listJobs.mockResolvedValue(mockJobList);

    const result = await handleListJobs({}, mockConfig);

    expect(result.content[0].text).toContain('...');
    const parsedResult = JSON.parse(result.content[0].text.split(':\n\n')[1]);
    expect(parsedResult.jobs[0].query.length).toBeLessThanOrEqual(203); // 200 + '...'
  });

  it('should handle API errors', async () => {
    const error = new Error('API Error: HTTP 401 - Unauthorized');
    mockJobClient.listJobs.mockRejectedValue(error);

    const result = await handleListJobs({}, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error listing jobs: API Error: HTTP 401 - Unauthorized');
  });

  it('should validate input parameters', async () => {
    const invalidArgs = {
      status: 'invalid_status',
      limit: -1,
    };

    const result = await handleListJobs(invalidArgs, mockConfig);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error listing jobs');
    expect(result.content[0].text).toContain('Invalid enum value');
  });
});