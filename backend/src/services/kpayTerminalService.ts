/**
 * KPay POS Terminal Service
 * Handles communication with KPay POS terminals
 * 
 * KPay Terminal API Integration:
 * - Base URL: http://{terminal_ip}:{terminal_port}
 * - Default: 192.168.50.210:18080
 * - Sign endpoint: POST /v2/pos/sign
 * 
 * This service manages:
 * 1. Sign requests to initialize payment sessions
 * 2. Request/response handling with proper error management
 * 3. Credential validation and terminal connectivity checks
 */

import axios, { AxiosInstance } from 'axios';

export interface KPaySignRequest {
  appId: string;
  appSecret: string;
  timestamp?: number;
  nonce?: string;
  [key: string]: any;
}

export interface KPaySignResponse {
  code?: string;
  message?: string;
  data?: {
    sign?: string; // Signature from terminal
    timestamp?: number;
    nonce?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface KPayTerminalConfig {
  appId: string;
  appSecret: string;
  terminalIp: string;
  terminalPort: number;
  endpointPath?: string;
}

/**
 * KPayTerminalService
 * Handles all communication with KPay POS terminals
 */
class KPayTerminalService {
  private client: AxiosInstance | null = null;
  private config: KPayTerminalConfig | null = null;

  /**
   * Initialize the service with terminal configuration
   */
  initialize(config: KPayTerminalConfig): void {
    this.config = config;
    
    const baseURL = `http://${config.terminalIp}:${config.terminalPort}`;
    
    this.client = axios.create({
      baseURL,
      timeout: 10000, // 10 second timeout for terminal communication
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (request) => {
        console.log(`[KPay] ${request.method?.toUpperCase()} ${request.url}`, {
          appId: config.appId,
          timestamp: new Date().toISOString(),
        });
        return request;
      },
      (error) => {
        console.error('[KPay] Request error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log('[KPay] Response received:', {
          status: response.status,
          code: response.data?.code,
        });
        return response;
      },
      (error) => {
        console.error('[KPay] Response error:', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test the connection to KPay terminal
   * Sends a sign request with appId and appSecret
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    response?: KPaySignResponse;
    error?: string;
  }> {
    if (!this.client || !this.config) {
      return {
        success: false,
        message: 'KPay service not initialized',
        error: 'Service not initialized. Configuration missing.',
      };
    }

    try {
      console.log('[KPay] Testing connection to terminal...');
      
      const signRequest = this.buildSignRequest();
      const response = await this.sendSignRequest(signRequest);

      if (response && (response.code === '0' || response.data?.sign)) {
        return {
          success: true,
          message: 'Successfully connected to KPay terminal',
          response,
        };
      }

      return {
        success: false,
        message: 'Terminal returned error response',
        response,
        error: response?.message || 'Unknown error',
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Connection failed';
      return {
        success: false,
        message: `Failed to connect to KPay terminal: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Build a sign request with proper credentials
   */
  private buildSignRequest(): KPaySignRequest {
    if (!this.config) {
      throw new Error('KPay service not initialized');
    }

    return {
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      timestamp: Math.floor(Date.now() / 1000),
      nonce: this.generateNonce(),
    };
  }

  /**
   * Send a sign request to the KPay terminal
   */
  async sendSignRequest(request: KPaySignRequest): Promise<KPaySignResponse> {
    if (!this.client) {
      throw new Error('KPay client not initialized');
    }

    if (!this.config) {
      throw new Error('KPay configuration not set');
    }

    const path = this.config.endpointPath || '/v2/pos/sign';
    
    try {
      console.log('[KPay] Sending sign request to', path);
      const response = await this.client.post<KPaySignResponse>(path, request);
      return response.data;
    } catch (error: any) {
      console.error('[KPay] Sign request failed:', error.message);
      
      if (error.response?.data) {
        // Terminal responded with an error
        return error.response.data;
      }

      // Network error or timeout
      throw new Error(
        `KPay terminal error: ${error.message}` +
        (error.code === 'ECONNREFUSED' ? ' - Connection refused (terminal not reachable)' : '')
      );
    }
  }

  /**
   * Generate a random nonce value
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get current configuration
   */
  getConfig(): KPayTerminalConfig | null {
    return this.config;
  }

  /**
   * Check if service is properly initialized
   */
  isInitialized(): boolean {
    return this.client !== null && this.config !== null;
  }
}

// Export singleton instance
export const kpayTerminalService = new KPayTerminalService();

export default KPayTerminalService;
