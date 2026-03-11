import { Pool, QueryResult } from 'pg';

export interface PrintJob {
  id: number;
  restaurant_id: number;
  order_id?: string | null;
  session_id?: number | null;
  job_type: string;
  status: 'queued' | 'printing' | 'completed' | 'failed';
  priority: number;
  printer_zone_id?: number | null;
  retry_count: number;
  max_retries: number;
  payload: any;
  last_error_message?: string | null;
  created_at: Date;
  started_at?: Date | null;
  completed_at?: Date | null;
  next_retry_at?: Date | null;
}

export interface QueueConfig {
  maxConcurrentJobs?: number;
  retryIntervalSeconds?: number;
  maxRetryDelay?: number;
  pollIntervalMs?: number;
  jobTimeoutSeconds?: number;
}

export class PrinterQueueService {
  private pool: Pool;
  private config: QueueConfig;
  private processingJobs: Set<number> = new Set();
  private isRunning: boolean = false;
  private pollInterval?: NodeJS.Timer | undefined;
  private jobTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(pool: Pool, config: QueueConfig = {}) {
    this.pool = pool;
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 5,
      retryIntervalSeconds: config.retryIntervalSeconds || 30,
      maxRetryDelay: config.maxRetryDelay || 3600, // 1 hour
      pollIntervalMs: config.pollIntervalMs || 2000, // 2 seconds
      jobTimeoutSeconds: config.jobTimeoutSeconds || 120, // 2 minutes
    };
  }

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[PrinterQueue] Queue already running');
      return;
    }

    this.isRunning = true;
    console.log('[PrinterQueue] Starting printer queue processor');

    // Start polling
    this.pollInterval = setInterval(() => {
      this.processQueue().catch(err => {
        console.error('[PrinterQueue] Error processing queue:', err);
      });
    }, this.config.pollIntervalMs);

    // Process once immediately
    await this.processQueue();
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    console.log('[PrinterQueue] Stopping printer queue processor');

    if (this.pollInterval) {
      clearInterval(this.pollInterval as any);
      this.pollInterval = undefined;
    }

    // Clear all timers
    for (const timer of this.jobTimers.values()) {
      clearTimeout(timer);
    }
    this.jobTimers.clear();

    // Wait for any processing jobs to complete
    while (this.processingJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    restaurantId: number,
    payload: any,
    options: {
      jobType?: string;
      orderId?: string;
      sessionId?: number;
      priority?: number;
      printerZoneId?: number;
      maxRetries?: number;
    } = {}
  ): Promise<PrintJob> {
    const {
      jobType = 'qr',
      orderId = null,
      sessionId = null,
      priority = 0,
      printerZoneId = null,
      maxRetries = 3,
    } = options;

    const query = `
      INSERT INTO print_queue (
        restaurant_id, order_id, session_id, job_type, status, priority, 
        printer_zone_id, retry_count, max_retries, payload, created_at
      )
      VALUES ($1, $2, $3, $4, 'queued', $5, $6, 0, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await this.pool.query(query, [
      restaurantId,
      orderId,
      sessionId,
      jobType,
      priority,
      printerZoneId,
      maxRetries,
      JSON.stringify(payload),
    ]);

    const job = result.rows[0];
    console.log(`[PrinterQueue] Job #${job.id} queued for restaurant ${restaurantId} (type: ${jobType})`);
    return this.formatJob(job);
  }

  /**
   * Get job status
   */
  async getJob(jobId: number): Promise<PrintJob | null> {
    const result = await this.pool.query(
      'SELECT * FROM print_queue WHERE id = $1',
      [jobId]
    );
    return result.rows.length > 0 ? this.formatJob(result.rows[0]) : null;
  }

  /**
   * Get queue status by restaurant
   */
  async getQueueStatus(restaurantId: number): Promise<{
    queued: number;
    printing: number;
    completed: number;
    failed: number;
    totalRetries: number;
  }> {
    const result = await this.pool.query(
      `SELECT 
        SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'printing' THEN 1 ELSE 0 END) as printing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(retry_count) as total_retries
      FROM print_queue
      WHERE restaurant_id = $1`,
      [restaurantId]
    );

    const row = result.rows[0];
    return {
      queued: parseInt(row.queued) || 0,
      printing: parseInt(row.printing) || 0,
      completed: parseInt(row.completed) || 0,
      failed: parseInt(row.failed) || 0,
      totalRetries: parseInt(row.total_retries) || 0,
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: number): Promise<PrintJob | null> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job #${jobId} not found`);
    }

    if (job.status !== 'failed') {
      throw new Error(`Cannot retry job #${jobId} with status '${job.status}'`);
    }

    const result = await this.pool.query(
      `UPDATE print_queue 
       SET status = 'queued', retry_count = 0, next_retry_at = NULL, error_message = NULL
       WHERE id = $1
       RETURNING *;`,
      [jobId]
    );

    console.log(`[PrinterQueue] Job #${jobId} retried`);
    return this.formatJob(result.rows[0]);
  }

  /**
   * Main queue processing loop
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    // Don't exceed max concurrent jobs
    if (this.processingJobs.size >= this.config.maxConcurrentJobs!) {
      return;
    }

    // Get next queued job with highest priority
    const result = await this.pool.query(
      `SELECT * FROM print_queue 
       WHERE status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
       ORDER BY priority DESC, created_at ASC
       LIMIT 1;`
    );

    if (result.rows.length === 0) {
      return; // No jobs to process
    }

    const job = this.formatJob(result.rows[0]);
    this.processJob(job).catch(err => {
      console.error(`[PrinterQueue] Unexpected error processing job #${job.id}:`, err);
    });
  }

  /**
   * Process a single print job
   */
  private async processJob(job: PrintJob): Promise<void> {
    if (this.processingJobs.has(job.id)) {
      return; // Already processing
    }

    this.processingJobs.add(job.id);

    try {
      // Mark as printing
      await this.pool.query(
        'UPDATE print_queue SET status = $1 WHERE id = $2',
        ['printing', job.id]
      );

      // Set timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Job timeout'));
        }, (this.config.jobTimeoutSeconds || 120) * 1000);
        this.jobTimers.set(job.id, timer);
      });

      // Execute print job
      const printPromise = this.executePrintJob(job);

      // Race: print vs timeout
      await Promise.race([printPromise, timeoutPromise]);

      // Clear timeout
      const timer = this.jobTimers.get(job.id);
      if (timer) {
        clearTimeout(timer);
        this.jobTimers.delete(job.id);
      }

      // Mark as completed
      await this.pool.query(
        'UPDATE print_queue SET status = $1 WHERE id = $2',
        ['completed', job.id]
      );

      console.log(`[PrinterQueue] Job #${job.id} completed successfully`);
    } catch (error: any) {
      await this.handleJobFailure(job, error);
    } finally {
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Execute the actual print job (implement with your printer API)
   */
  private async executePrintJob(job: PrintJob): Promise<void> {
    // This is a placeholder - implement based on your printer API
    // Examples:
    // - Send to thermal printer via network
    // - Send to browser print dialog
    // - Send to cloud print service

    console.log(`[PrinterQueue] Executing job #${job.id}:`, {
      orderId: job.order_id,
      billId: job.bill_id,
      printerZoneId: job.printer_zone_id,
      payloadSize: JSON.stringify(job.payload).length,
    });

    // Simulate print execution
    // In production, replace with actual printer communication
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Example: could throw error to trigger retry
    // throw new Error('Printer connection failed');
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: PrintJob, error: any): Promise<void> {
    const errorMessage = error?.message || 'Unknown error';

    if (job.retry_count < job.max_retries) {
      // Calculate exponential backoff
      const backoffSeconds = Math.min(
        this.config.retryIntervalSeconds! * Math.pow(2, job.retry_count),
        this.config.maxRetryDelay!
      );

      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

      await this.pool.query(
        `UPDATE print_queue 
         SET status = 'queued', 
             retry_count = retry_count + 1,
             next_retry_at = $1,
             error_message = $2
         WHERE id = $3`,
        [nextRetryAt, errorMessage, job.id]
      );

      console.log(
        `[PrinterQueue] Job #${job.id} failed (${job.retry_count + 1}/${job.max_retries} retries). ` +
        `Next retry in ${backoffSeconds}s. Error: ${errorMessage}`
      );
    } else {
      // Max retries exceeded
      await this.pool.query(
        `UPDATE print_queue 
         SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [errorMessage, job.id]
      );

      console.error(
        `[PrinterQueue] Job #${job.id} failed permanently after ${job.max_retries} retries. ` +
        `Error: ${errorMessage}`
      );
    }

    // Clear timeout
    const timer = this.jobTimers.get(job.id);
    if (timer) {
      clearTimeout(timer);
      this.jobTimers.delete(job.id);
    }
  }

  /**
   * Clear completed jobs (cleanup)
   */
  async clearCompletedJobs(restaurantId: number, olderThanHours: number = 24): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM print_queue
       WHERE restaurant_id = $1 
       AND status = 'completed'
       AND created_at < CURRENT_TIMESTAMP - INTERVAL '${olderThanHours} hours'`,
      [restaurantId]
    );

    return result.rowCount || 0;
  }

  /**
   * Format raw job from database
   */
  private formatJob(row: any): PrintJob {
    return {
      id: row.id,
      restaurant_id: row.restaurant_id,
      order_id: row.order_id,
      bill_id: row.bill_id,
      status: row.status,
      priority: row.priority,
      printer_zone_id: row.printer_zone_id,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      created_at: new Date(row.created_at),
      next_retry_at: row.next_retry_at ? new Date(row.next_retry_at) : (undefined as any),
      error_message: row.error_message,
    };
  }

  /**
   * Get processing stats
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      processingJobsCount: this.processingJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
    };
  }
}

// Singleton instance (optional)
let queueInstance: PrinterQueueService | null = null;

export function getPrinterQueueService(pool: Pool, config?: QueueConfig): PrinterQueueService {
  if (!queueInstance) {
    queueInstance = new PrinterQueueService(pool, config);
  }
  return queueInstance;
}
