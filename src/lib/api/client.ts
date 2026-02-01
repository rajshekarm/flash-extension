// Main API client for Flash backend
import axios, { AxiosInstance, AxiosError } from 'axios';
import { getAPISettings } from '../storage/chrome';
import { retry } from '../utils/helpers';

export class FlashAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'FlashAPIError';
  }
}

export class FlashNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlashNetworkError';
  }
}

class FlashAPIClient {
  private client: AxiosInstance | null = null;
  private baseURL: string = '';
  private apiKey: string = '';

  async initialize() {
    const settings = await getAPISettings();
    this.baseURL = settings.baseURL;
    this.apiKey = settings.apiKey;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: settings.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          // Server responded with error
          throw new FlashAPIError(
            error.response.status,
            error.message,
            error.response.data
          );
        } else if (error.request) {
          // No response received
          throw new FlashNetworkError('Backend is unreachable');
        } else {
          // Request setup error
          throw new Error(error.message);
        }
      }
    );
  }

  private ensureInitialized() {
    if (!this.client) {
      throw new Error('API client not initialized. Call initialize() first.');
    }
  }

  // Generic request method with retry logic
  private async request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any
  ): Promise<T> {
    this.ensureInitialized();

    return retry(
      async () => {
        const response = await this.client![method](url, data);
        return response.data;
      },
      { maxAttempts: 3, delay: 1000, backoff: true }
    );
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request('get', '/health');
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  // Update API settings
  async updateSettings(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    await this.initialize();
  }

  // Get the axios instance for custom requests
  getClient(): AxiosInstance | null {
    return this.client;
  }
}

// Create singleton instance
export const apiClient = new FlashAPIClient();

// Initialize on import
apiClient.initialize().catch((error) => {
  console.error('Failed to initialize API client:', error);
});
