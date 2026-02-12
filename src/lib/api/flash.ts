// Flash Service API Methods
import { apiClient } from './client';
import type {
  JobDescription,
  JobAnalysis,
  TailoredResume,
  QuestionContext,
  Answer,
  FormField,
  UserProfile,
  ApplicationData,
} from '~types';

export class FlashAPI {
  /**
   * Analyze a job description
   */
  async analyzeJob(jobDescription: JobDescription, userId?: string): Promise<JobAnalysis> {
    const response = await apiClient.getClient()!.post('/api/flash/analyze-job', {
      job_description: jobDescription,
      user_id: userId,
    });
    return response.data;
  }

  /**
   * Tailor resume for a specific job
   */
  async tailorResume(
    jobId: string,
    userId: string,
    jobAnalysis?: JobAnalysis
  ): Promise<TailoredResume> {
    const response = await apiClient.getClient()!.post('/api/flash/tailor-resume', {
      job_id: jobId,
      user_id: userId,
      job_analysis: jobAnalysis,
    });
    return response.data;
  }

  /**
   * Answer a single question
   */
  async answerQuestion(
    questionContext: QuestionContext,
    userId: string,
    jobId?: string
  ): Promise<Answer> {
    const response = await apiClient.getClient()!.post('/api/flash/answer-question', {
      question_context: questionContext,
      user_id: userId,
      job_id: jobId,
    });
    return response.data;
  }

  /**
   * Fill entire application form
   */
  // async fillApplication(
  //   formFields: FormField[],
  //   userId: string,
  //   jobId?: string
  // ): Promise<{ answers: Answer[]; overall_confidence: number }> {
  //   const response = await apiClient.getClient()!.post('/api/flash/fill-application', {
  //     form_fields: formFields,
  //     user_id: userId,
  //     job_id: jobId,
  //   });
  //   return response.data;
  // }

  async fillApplication(
    formFields: FormField[],
    userId: string,
    jobId?: string
  ): Promise<{ answers: Answer[]; overall_confidence: number }> {
    const response = await apiClient.getClient()!.post('/api/flash/fill-application-form', {
      form_fields: formFields,
      user_id: userId,
      job_id: jobId,
    });
    return response.data;
  }

  /**
   * Approve and submit application
   */
  async approveApplication(
    applicationId: string,
    userId: string,
    approvedAnswers: Answer[]
  ): Promise<{ application_id: string; status: string }> {
    const response = await apiClient.getClient()!.post('/api/flash/approve-application', {
      application_id: applicationId,
      user_id: userId,
      approved_answers: approvedAnswers,
    });
    return response.data;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const response = await apiClient.getClient()!.get(`/api/flash/profile/${userId}`);
    return response.data;
  }

  /**
   * Create or update user profile
   */
  async saveUserProfile(profile: UserProfile): Promise<UserProfile> {
    const response = await apiClient.getClient()!.post('/api/flash/profile', profile);
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
}

// Export singleton instance
export const flashAPI = new FlashAPI();
