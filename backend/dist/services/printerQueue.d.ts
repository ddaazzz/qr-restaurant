import { Pool } from 'pg';
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
export declare class PrinterQueueService {
    private pool;
    private config;
    private processingJobs;
    private isRunning;
    private pollInterval?;
    private jobTimers;
    constructor(pool: Pool, config?: QueueConfig);
    /**
     * Start the queue processor
     */
    start(): Promise<void>;
    /**
     * Stop the queue processor
     */
    stop(): Promise<void>;
    /**
     * Add a job to the queue
     */
    addJob(restaurantId: number, payload: any, options?: {
        jobType?: string;
        orderId?: string;
        sessionId?: number;
        priority?: number;
        printerZoneId?: number;
        maxRetries?: number;
    }): Promise<PrintJob>;
    /**
     * Get job status
     */
    getJob(jobId: number): Promise<PrintJob | null>;
    /**
     * Get queue status by restaurant
     */
    getQueueStatus(restaurantId: number): Promise<{
        queued: number;
        printing: number;
        completed: number;
        failed: number;
        totalRetries: number;
    }>;
    /**
     * Retry a failed job
     */
    retryJob(jobId: number): Promise<PrintJob | null>;
    /**
     * Main queue processing loop
     */
    private processQueue;
    /**
     * Process a single print job
     */
    private processJob;
    /**
     * Execute the actual print job (implement with your printer API)
     */
    private executePrintJob;
    /**
     * Handle job failure with retry logic
     */
    private handleJobFailure;
    /**
     * Clear completed jobs (cleanup)
     */
    clearCompletedJobs(restaurantId: number, olderThanHours?: number): Promise<number>;
    /**
     * Format raw job from database
     */
    private formatJob;
    /**
     * Get processing stats
     */
    getStats(): {
        isRunning: boolean;
        processingJobsCount: number;
        maxConcurrentJobs: number | undefined;
    };
}
export declare function getPrinterQueueService(pool: Pool, config?: QueueConfig): PrinterQueueService;
//# sourceMappingURL=printerQueue.d.ts.map