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

    // Request interceptor - add auth headers and logging
    this.client.interceptors.request.use(
      (config) => {
        // Log outgoing requests (excluding file uploads for cleaner logs)
        const contentType = String(config.headers['Content-Type'] || '');
        const isFileUpload = contentType.includes('multipart/form-data');
        if (!isFileUpload) {
          console.log(`[API Client] → ${config.method?.toUpperCase()} ${config.url}`, 
            config.data ? { body: config.data } : '');
        }

        // Prioritize JWT token over API key
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        } else if (this.apiKey) {
          config.headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return config;
      },
      (error) => {
        console.error('[API Client] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => {
        // Log successful responses (excluding large payloads)
        const responseSize = JSON.stringify(response.data).length;
        if (responseSize < 1000) {
          console.log(`[API Client] ← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, 
            { data: response.data });
        } else {
          console.log(`[API Client] ← ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, 
            `[${responseSize} chars]`);
        }
        return response;
      },
      async (error: AxiosError) => {
        // Log error responses
        if (error.response) {
          console.error(`[API Client] ← ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, 
            { error: error.response.data });
        } else if (error.request) {
          console.error(`[API Client] ← NETWORK_ERROR ${error.config?.method?.toUpperCase()} ${error.config?.url}`, 
            { message: 'No response received' });
        } else {
          console.error(`[API Client] ← REQUEST_ERROR`, error.message);
        }

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
          const responseData = error.response.data as any;
          const errorMessage = responseData?.detail || 
                              responseData?.message || 
                              responseData?.error ||
                              error.message ||
                              `HTTP ${error.response.status} Error`;
          
          throw new FlashAPIError(
            error.response.status,
            errorMessage,
            error.response.data
          );
        } else if (error.request) {
          // No response received
          throw new FlashNetworkError('Backend is unreachable - check if server is running');
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
    console.log('[API Client] Updated settings:', { baseURL, hasApiKey: !!apiKey });
    await this.initialize();
  }

  // Get current settings for debugging
  getSettings() {
    return {
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
      hasAuthToken: !!this.authToken,
      hasClient: !!this.client
    };
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
