/**
 * Print Queue Service
 * 
 * Manages a queue of print jobs that failed due to temporary disconnection
 * Automatically retries when printer reconnects
 */

export interface QueuedPrintJob {
  id: string; // Unique job ID
  orderId: string;
  printerType: 'qr' | 'bill' | 'kitchen';
  deviceId: string;
  content: string; // ESC/POS commands or other format
  timestamp: number; // When job was queued
  retryCount: number;
  maxRetries: number;
}

class PrintQueueService {
  private queue: Map<string, QueuedPrintJob> = new Map();
  private onRetryCallbacks: ((job: QueuedPrintJob) => Promise<boolean>)[] = [];

  /**
   * Add a print job to the queue
   */
  addJob(
    orderId: string,
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId: string,
    content: string,
    maxRetries: number = 3
  ): string {
    const jobId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: QueuedPrintJob = {
      id: jobId,
      orderId,
      printerType,
      deviceId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };
    
    this.queue.set(jobId, job);
    console.log(`[PrintQueue] Added job ${jobId} for order ${orderId} (${this.queue.size} jobs queued)`);
    
    return jobId;
  }

  /**
   * Get a specific job from the queue
   */
  getJob(jobId: string): QueuedPrintJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get all queued jobs
   */
  getAllJobs(): QueuedPrintJob[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get jobs for a specific printer type
   */
  getJobsForPrinter(
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId?: string
  ): QueuedPrintJob[] {
    return Array.from(this.queue.values()).filter(
      job => job.printerType === printerType && (!deviceId || job.deviceId === deviceId)
    );
  }

  /**
   * Remove a job from the queue (success or permanent failure)
   */
  removeJob(jobId: string): void {
    this.queue.delete(jobId);
    console.log(`[PrintQueue] Removed job ${jobId} (${this.queue.size} jobs remaining)`);
  }

  /**
   * Increment retry count for a job
   */
  incrementRetry(jobId: string): boolean {
    const job = this.queue.get(jobId);
    if (!job) return false;

    job.retryCount++;
    if (job.retryCount > job.maxRetries) {
      console.warn(`[PrintQueue] Job ${jobId} exceeded max retries (${job.maxRetries}), removing from queue`);
      this.queue.delete(jobId);
      return false;
    }

    console.log(`[PrintQueue] Retry ${job.retryCount}/${job.maxRetries} for job ${jobId}`);
    return true;
  }

  /**
   * Register callback to retry print jobs
   * Called when printer reconnects
   */
  onRetry(callback: (job: QueuedPrintJob) => Promise<boolean>): void {
    this.onRetryCallbacks.push(callback);
  }

  /**
   * Process all queued jobs for a printer (e.g., after reconnection)
   */
  async retryJobsForPrinter(
    printerType: 'qr' | 'bill' | 'kitchen',
    deviceId?: string
  ): Promise<{ succeeded: number; failed: number }> {
    const jobs = this.getJobsForPrinter(printerType, deviceId);
    if (jobs.length === 0) {
      console.log(`[PrintQueue] No jobs to retry for ${printerType}`);
      return { succeeded: 0, failed: 0 };
    }

    console.log(`[PrintQueue] Retrying ${jobs.length} jobs for ${printerType}`);
    
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      let jobSucceeded = false;

      // Try all registered retry callbacks
      for (const callback of this.onRetryCallbacks) {
        try {
          if (await callback(job)) {
            jobSucceeded = true;
            break;
          }
        } catch (err) {
          console.error(`[PrintQueue] Retry callback error:`, err);
        }
      }

      if (jobSucceeded) {
        this.removeJob(job.id);
        succeeded++;
      } else {
        if (this.incrementRetry(job.id)) {
          failed++;
        }
      }
    }

    console.log(`[PrintQueue] Retry complete: ${succeeded} succeeded, ${failed} still queued`);
    return { succeeded, failed };
  }

  /**
   * Clear all queued jobs
   */
  clearAll(): void {
    const count = this.queue.size;
    this.queue.clear();
    console.log(`[PrintQueue] Cleared ${count} queued jobs`);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalJobs: number;
    byPrinterType: { [key: string]: number };
  } {
    const stats = {
      totalJobs: this.queue.size,
      byPrinterType: {} as { [key: string]: number },
    };

    for (const job of this.queue.values()) {
      if (!stats.byPrinterType[job.printerType]) {
        stats.byPrinterType[job.printerType] = 0;
      }
      stats.byPrinterType[job.printerType]++;
    }

    return stats;
  }
}

export const printQueueService = new PrintQueueService();
export default PrintQueueService;
