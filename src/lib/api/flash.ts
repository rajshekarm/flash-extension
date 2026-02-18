// Flash Service API Methods
import { apiClient } from './client';
import type {
  JobDescription,
  JobAnalysis,
  TailoredResume,
  QuestionContext,
  Answer,
  ApplicationQuestion,
  UserProfile,
  ApplicationData,
  LoginRequest,
  RegisterRequest,
  AuthSession,
  AuthUser,
  RefreshTokenRequest,
} from '~types';

export class FlashAPI {
  constructor() {
    // Ensure API client is initialized
    this.ensureInitialized();
  }

  private async ensureInitialized() {
    try {
      const client = apiClient.getClient();
      if (!client) {
        console.log('[FlashAPI] Initializing API client...');
        await apiClient.initialize();
        const settings = await apiClient.getSettings();
        console.log('[FlashAPI] API client initialized with settings:', settings);
      }
    } catch (error) {
      console.error('[FlashAPI] Failed to initialize API client:', error);
    }
  }

  /**
   * Analyze a job description
   */
  async analyzeJob(
    jobDescription: JobDescription,
    userId?: string,
    userProfile?: Partial<UserProfile>
  ): Promise<JobAnalysis> {
    return await this.postWithOptionalProfile('/api/flash/analyze-job', {
      job_description: jobDescription,
      user_id: userId,
    }, userProfile);
  }

  /**
   * Tailor resume for a specific job
   */
  async tailorResume(
    jobId: string,
    userId: string,
    jobAnalysis?: JobAnalysis,
    userProfile?: Partial<UserProfile>
  ): Promise<TailoredResume> {
    return await this.postWithOptionalProfile('/api/flash/tailor-resume', {
      job_id: jobId,
      user_id: userId,
      job_analysis: jobAnalysis,
    }, userProfile);
  }

  /**
   * Answer a single question
   */
  async answerQuestion(
    questionContext: QuestionContext,
    userId: string,
    jobId?: string,
    userProfile?: Partial<UserProfile>
  ): Promise<Answer> {
    return await this.postWithOptionalProfile('/api/flash/answer-question', {
      question_context: questionContext,
      user_id: userId,
      job_id: jobId,
    }, userProfile);
  }

  /**
   * Fill entire application form
   */
  async fillApplication(
    questions: ApplicationQuestion[],
    userId: string,
    jobId?: string,
    userProfile?: Partial<UserProfile>
  ): Promise<{ answers: Answer[]; overall_confidence: number }> {
    console.log("request to fill the application")

    const payload = {
      questions,
      user_id: userId,
      job_id: jobId,
    };

    return await this.postWithOptionalProfile('/api/flash/fill-application-form', payload, userProfile);
  }

  /**
   * Approve and submit application
   */
  async approveApplication(
    applicationId: string,
    userId: string,
    approvedAnswers: Answer[],
    userProfile?: Partial<UserProfile>
  ): Promise<{ application_id: string; status: string }> {
    return await this.postWithOptionalProfile('/api/flash/approve-application', {
      application_id: applicationId,
      user_id: userId,
      approved_answers: approvedAnswers,
    }, userProfile);
  }

  private async postWithOptionalProfile<T>(
    url: string,
    payload: Record<string, any>,
    userProfile?: Partial<UserProfile>
  ): Promise<T> {
    const client = apiClient.getClient()!
    const body = userProfile ? { ...payload, user_profile: userProfile } : payload

    try {
      const response = await client.post(url, body)
      return response.data
    } catch (error: any) {
      const status = error?.response?.status
      if (userProfile && (status === 400 || status === 422)) {
        console.warn(`[FlashAPI] ${url} rejected user_profile, retrying without profile context`, { status })
        const retryResponse = await client.post(url, payload)
        return retryResponse.data
      }
      throw error
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await apiClient.getClient()!.get(`/api/flash/user-profile/${userId}`);
    return response.data;
  }

  /**
   * Create a new user profile
   */
  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const response = await apiClient.getClient()!.post('/api/flash/user-profile', profile);
    return response.data;
  }

  /**
   * Update an existing user profile
   */
  async updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile> {
    const response = await apiClient.getClient()!.put(`/api/flash/user-profile/${userId}`, profile);
    return response.data;
  }

  /**
   * Delete a user profile
   */
  async deleteUserProfile(userId: string): Promise<void> {
    await apiClient.getClient()!.delete(`/api/flash/user-profile/${userId}`);
  }

  /**
   * List all user profiles
   */
  async listUserProfiles(): Promise<UserProfile[]> {
    const response = await apiClient.getClient()!.get('/api/flash/user-profiles');
    return response.data;
  }

  /**
   * Get application history
   */
  async getApplicationHistory(userId: string): Promise<ApplicationData[]> {
    const response = await apiClient.getClient()!.get(`/api/flash/applications/${userId}`);
    return response.data;
  }

  /**
   * Get specific application
   */
  async getApplication(applicationId: string): Promise<ApplicationData> {
    const response = await apiClient.getClient()!.get(`/api/flash/application/${applicationId}`);
    return response.data;
  }

  /**
   * Delete application
   */
  async deleteApplication(applicationId: string): Promise<void> {
    await apiClient.getClient()!.delete(`/api/flash/application/${applicationId}`);
  }

  /**
   * Upload resume file
   */
  async uploadResume(userId: string, file: File): Promise<{ url: string; text: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);

    const response = await apiClient.getClient()!.post('/api/flash/upload-resume', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    return await apiClient.healthCheck();
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    return await apiClient.testConnection();
  }

  // Authentication Methods

  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthSession> {
    console.log('[FlashAPI] Attempting login...', { email: credentials.email });
    const response = await apiClient.getClient()!.post('/api/flash/auth/login', credentials);
    
    // Backend returns {success, data} wrapper - extract actual auth session
    const authSession = response.data.data || response.data;
    console.log('[FlashAPI] Login response unwrapped:', {
      hasWrapper: !!response.data.data,
      hasUser: !!authSession.user,
      hasToken: !!authSession.access_token
    });
    
    // Update API client with new auth token
    await apiClient.setAuthToken(authSession.access_token);
    
    return authSession;
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterRequest): Promise<AuthSession> {
    console.log('[FlashAPI] Attempting registration...', { name: credentials.name, email: credentials.email });
    
    try {
      const response = await apiClient.getClient()!.post('/api/flash/auth/register', credentials);
      console.log('[FlashAPI] Registration response received:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      
      // Backend returns {success, data} wrapper - extract actual auth session
      const authSession = response.data.data || response.data;
      console.log('[FlashAPI] Registration response unwrapped:', {
        hasWrapper: !!response.data.data,
        hasUser: !!authSession.user,
        hasToken: !!authSession.access_token
      });
      
      // Update API client with new auth token
      await apiClient.setAuthToken(authSession.access_token);
      
      console.log('[FlashAPI] Registration successful, auth token set');
      return authSession;
    } catch (error) {
      console.error('[FlashAPI] Registration failed with error:', error);
      if (error instanceof Error) {
        console.error('[FlashAPI] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.getClient()!.post('/api/flash/auth/logout');
    
    // Clear auth token from API client
    await apiClient.clearAuthToken();
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<AuthUser> {
    console.log('[FlashAPI] Getting current user info...');
    const response = await apiClient.getClient()!.get('/api/flash/auth/me');
    return response.data;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(request: RefreshTokenRequest): Promise<{ access_token: string; expires_at: string }> {
    console.log('[FlashAPI] Refreshing authentication token...');
    const response = await apiClient.getClient()!.post('/api/flash/auth/refresh', request);
    const refreshData = response.data;
    
    // Update API client with new auth token
    await apiClient.setAuthToken(refreshData.access_token);
    
    return refreshData;
  }
}

// Export singleton instance
export const flashAPI = new FlashAPI();
