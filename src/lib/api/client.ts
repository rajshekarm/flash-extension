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
  private authToken: string = '';

  async initialize() {
    const settings = await getAPISettings();
    this.baseURL = settings.baseURL;
    this.apiKey = settings.apiKey;

    // Try to get auth token from storage
    try {
      const authToken = await chrome.storage.local.get(['authToken']);
      this.authToken = authToken.authToken || '';
    } catch (error) {
      console.warn('[API Client] Failed to get auth token:', error);
      this.authToken = '';
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: settings.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth headers
    this.client.interceptors.request.use(
      (config) => {
        // Prioritize JWT token over API key
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        } else if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response) {
          // Handle 401 Unauthorized - try token refresh
          if (error.response.status === 401 && this.authToken) {
            console.log('[API Client] Token expired, attempting refresh...');
            try {
              const refreshResult = await this.refreshAuthToken();
              if (refreshResult && error.config) {
                // Retry the original request with new token
                error.config.headers.Authorization = `Bearer ${this.authToken}`;
                return axios.request(error.config);
              }
            } catch (refreshError) {
              console.warn('[API Client] Token refresh failed:', refreshError);
              // Clear invalid tokens
              this.authToken = '';
              await chrome.storage.local.remove(['authToken', 'authSession', 'refreshToken']);
            }
          }
          
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

  private async refreshAuthToken(): Promise<boolean> {
    try {
      const refreshTokenData = await chrome.storage.local.get(['refreshToken']);
      const refreshToken = refreshTokenData.refreshToken;
      
      if (!refreshToken) {
        return false;
      }

      const response = await axios.post(`${this.baseURL}/api/auth/refresh`, {
        refresh_token: refreshToken
      });

      if (response.data?.access_token) {
        this.authToken = response.data.access_token;
        await chrome.storage.local.set({ 
          authToken: this.authToken,
          expires_at: response.data.expires_at 
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[API Client] Refresh token error:', error);
      return false;
    }
  }

  // Update auth token (called when user logs in)
  async setAuthToken(token: string) {
    this.authToken = token;
    if (this.client) {
      this.client.defaults.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Clear auth token (called when user logs out)
  async clearAuthToken() {
    this.authToken = '';
    if (this.client) {
      delete this.client.defaults.headers.Authorization;
    }
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
