import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createJobClient } from '../client/job';
import { Config } from '../types';

const GetJobArgsSchema = z.object({
  job_id: z.string().describe('The job ID to retrieve details for'),
});

export const getJobTool: Tool = {
  name: 'get_job',
  description: 'Gets complete details of a specific job by job ID, including full query, execution details, and error information if available.',
  inputSchema: {
    type: 'object',
    properties: {
      job_id: {
        type: 'string',
        description: 'The job ID to retrieve details for',
      },
    },
    required: ['job_id'],
    additionalProperties: false,
  },
};

export async function handleGetJob(args: unknown, config: Config): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { job_id } = GetJobArgsSchema.parse(args);
    
    const jobClient = createJobClient(config);
    const job = await jobClient.getJob(job_id);
    
    // Format the job details
    const jobDetails: Record<string, unknown> = {
      job_id: job.job_id,
      type: job.type,
      status: job.status,
      database: job.database,
      query: job.query,
      url: job.url,
      created_at: job.created_at,
      updated_at: job.updated_at,
      start_at: job.start_at,
      end_at: job.end_at,
      num_records: job.num_records,
      priority: job.priority,
      retry_limit: job.retry_limit,
      result: job.result,
      organization: job.organization,
    };

    // Add debug information if available
    if (job.debug) {
      jobDetails['debug'] = {
        ...(job.debug.stderr && { error_message: job.debug.stderr }),
        ...(job.debug.cmdout && { output: job.debug.cmdout }),
      };
    }

    // Calculate execution time if available
    if (job.start_at && job.end_at) {
      const startTime = new Date(job.start_at);
      const endTime = new Date(job.end_at);
      const executionTime = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      jobDetails['execution_time_seconds'] = executionTime;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Job Details:\n\n${JSON.stringify(jobDetails, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting job details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}