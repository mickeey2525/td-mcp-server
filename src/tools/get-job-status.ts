import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { createJobClient } from '../client/job';
import { Config } from '../types';

const GetJobStatusArgsSchema = z.object({
  job_id: z.string().describe('The job ID to check status for'),
  include_details: z.boolean().optional().default(false)
    .describe('Include full job details including query and debug information'),
});

export const getJobStatusTool: Tool = {
  name: 'get_job_status',
  description: 'Gets the status and details of a specific job by job ID. Shows current status, execution times, error messages, and optionally full job details.',
  inputSchema: {
    type: 'object',
    properties: {
      job_id: {
        type: 'string',
        description: 'The job ID to check status for',
      },
      include_details: {
        type: 'boolean',
        default: false,
        description: 'Include full job details including query and debug information',
      },
    },
    required: ['job_id'],
    additionalProperties: false,
  },
};

export async function handleGetJobStatus(args: unknown, config: Config): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    const { job_id, include_details } = GetJobStatusArgsSchema.parse(args);
    
    const jobClient = createJobClient(config);
    const job = await jobClient.getJobStatus(job_id);
    
    // Base job status information
    const statusInfo: Record<string, unknown> = {
      job_id: job.job_id,
      status: job.status,
      type: job.type,
      database: job.database,
      created_at: job.created_at,
      updated_at: job.updated_at,
      start_at: job.start_at,
      end_at: job.end_at,
      num_records: job.num_records,
      organization: job.organization,
    };

    // Add error information if available
    if (job.debug?.stderr) {
      statusInfo['error_message'] = job.debug.stderr;
    }
    if (job.debug?.cmdout) {
      statusInfo['output'] = job.debug.cmdout;
    }

    // Add full details if requested
    if (include_details) {
      statusInfo['query'] = job.query;
      statusInfo['url'] = job.url;
      statusInfo['priority'] = job.priority;
      statusInfo['retry_limit'] = job.retry_limit;
      statusInfo['result'] = job.result;
      if (job.debug) {
        statusInfo['debug'] = job.debug;
      }
    }

    // Calculate execution time if available
    let executionTime;
    if (job.start_at && job.end_at) {
      const startTime = new Date(job.start_at);
      const endTime = new Date(job.end_at);
      executionTime = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
      statusInfo['execution_time_seconds'] = executionTime;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Job Status: ${job.status.toUpperCase()}\n\n${JSON.stringify(statusInfo, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting job status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
}