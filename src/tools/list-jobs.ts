import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createJobClient } from '../client/job';
import { Config } from '../types';

const ListJobsArgsSchema = z.object({
  from: z.number().optional().describe('Unix timestamp to filter jobs from (inclusive)'),
  to: z.number().optional().describe('Unix timestamp to filter jobs to (inclusive)'),  
  status: z.enum(['queued', 'booting', 'running', 'success', 'error', 'killed']).optional()
    .describe('Filter jobs by status'),
  conditions: z.string().optional()
    .describe('Additional filter conditions (e.g., "type=presto" or "database=sample_datasets")'),
  skip: z.number().min(0).optional().describe('Number of jobs to skip (for pagination)'),
  limit: z.number().min(1).max(1000).optional().describe('Maximum number of jobs to return (default: 20, max: 1000)'),
});

export const listJobsTool: Tool = {
  name: 'list_jobs',
  description: 'Lists jobs from Treasure Data with optional filtering by status, time range, and other conditions. Returns job metadata including status, query, creation time, and error information.',
  inputSchema: {
    type: 'object',
    properties: {
      from: {
        type: 'number',
        description: 'Unix timestamp to filter jobs from (inclusive)',
      },
      to: {
        type: 'number', 
        description: 'Unix timestamp to filter jobs to (inclusive)',
      },
      status: {
        type: 'string',
        enum: ['queued', 'booting', 'running', 'success', 'error', 'killed'],
        description: 'Filter jobs by status',
      },
      conditions: {
        type: 'string',
        description: 'Additional filter conditions (e.g., "type=presto" or "database=sample_datasets")',
      },
      skip: {
        type: 'number',
        minimum: 0,
        description: 'Number of jobs to skip (for pagination)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 1000,
        description: 'Maximum number of jobs to return (default: 20, max: 1000)',
      },
    },
    additionalProperties: false,
  },
};

export async function handleListJobs(args: unknown, config: Config): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const validatedArgs = ListJobsArgsSchema.parse(args);
    
    const jobClient = createJobClient(config);
    const result = await jobClient.listJobs(validatedArgs);
    
    // Format the response to make it more readable
    const formattedJobs = result.jobs.map((job) => ({
      job_id: job.job_id,
      type: job.type,
      status: job.status,
      database: job.database,
      query: job.query && typeof job.query === 'string' ? (job.query.length > 200 ? job.query.substring(0, 200) + '...' : job.query) : job.query, // Truncate long queries
      created_at: job.created_at,
      updated_at: job.updated_at,
      start_at: job.start_at,
      end_at: job.end_at,
      num_records: job.num_records,
      priority: job.priority,
      retry_limit: job.retry_limit,
      organization: job.organization,
      ...(job.debug?.stderr && { error_message: job.debug.stderr }),
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${result.count} jobs:\n\n${JSON.stringify({
            count: result.count,
            from: result.from,
            to: result.to,
            jobs: formattedJobs,
          }, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}