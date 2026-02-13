// Flash Service API Types
// These match the backend models from Atlas Flash Service

export interface UserProfile {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  password?: string | null;
  phone?: string;
  location?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  website_url?: string | null;
  twitter_url?: string | null;
  workday_profile_url?: string | null;
  pronouns?: string | null;
  date_of_birth?: string | null;
  current_title?: string | null;
  years_of_experience?: number | null;
  certifications?: string[] | null;
  languages?: string[] | null;
  preferred_roles?: string[];
  preferred_locations?: string[] | null;
  employment_type_preferences?: string[] | null;
  willing_to_relocate?: boolean | null;
  willing_to_travel?: boolean | null;
  remote_preference?: string | null;
  work_authorization?: string | null;
  legally_authorized_to_work?: boolean | null;
  requires_visa_sponsorship?: boolean | null;
  master_resume_path?: string | null;
  visa_status?: string | null;
  notice_period?: string | null;
  earliest_start_date?: string | null;
  salary_expectation?: string | null;
  desired_salary_min?: number | null;
  desired_salary_max?: number | null;
  desired_salary_currency?: string | null;
  links?: string[] | null;
  equal_opportunity_gender?: string | null;
  equal_opportunity_ethnicity?: string | null;
  equal_opportunity_veteran_status?: string | null;
  equal_opportunity_disability_status?: string | null;
  data_consent?: boolean | null;
  resume_url?: string;
  resume_text?: string;
  skills: string[];
  experience: WorkExperience[] | any[];
  education: Education[] | any[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  start_date: string;
  end_date?: string;
  current: boolean;
  description: string;
  technologies?: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  start_date: string;
  end_date?: string;
  gpa?: string;
}

export interface JobDescription {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  nice_to_have?: string[];
  url: string;
  location?: string;
  salary_range?: string;
  job_type?: string;
}

export interface JobAnalysis {
  job_id: string;
  required_skills: string[];
  preferred_skills: string[];
  technologies: string[];
  seniority_level: 'entry' | 'mid' | 'senior' | 'lead' | 'principal';
  role_focus: string[];
  match_score?: number;
  recommendations?: string[];
  analyzed_at: string;
}

export interface TailoredResume {
  original_resume: string;
  tailored_resume: string;
  changes: ResumeChange[];
  guardrail_checks: GuardrailCheck[];
  confidence: number;
}

export interface ResumeChange {
  section: string;
  original: string;
  modified: string;
  reason: string;
}

export interface GuardrailCheck {
  check_type: 'no_new_skills' | 'no_date_changes' | 'no_fake_experience' | 'truthfulness';
  passed: boolean;
  message: string;
}

export interface QuestionContext {
  question: string;
  field_id: string;
  field_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  options?: string[];
  job_id?: string;
  context?: string;
}

export interface Answer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  field_id: string;
}

export interface ApplicationData {
  user_id: string;
  job_id: string;
  form_fields: FormField[];
  answers: Answer[];
  status: 'draft' | 'reviewing' | 'approved' | 'submitted';
  submitted_at?: string;
}

export interface FormField {
  id: string;
  name?: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date';
  required: boolean;
  placeholder?: string;
  options?: string[];
  value?: string;
  validation?: string;
  validation_rules?: Record<string, any> | null;
}

export interface ConfidenceScore {
  score: number;
  level: 'high' | 'medium' | 'low';
  color: string;
}

// API Request/Response Types

export interface AnalyzeJobRequest {
  job_description: JobDescription;
  user_id?: string;
}

export interface AnalyzeJobResponse {
  success: boolean;
  data: JobAnalysis;
  error?: string;
}

export interface TailorResumeRequest {
  job_analysis: JobAnalysis;
  user_id: string;
}

export interface TailorResumeResponse {
  success: boolean;
  data: TailoredResume;
  error?: string;
}

export interface AnswerQuestionRequest {
  question_context: QuestionContext;
  user_id: string;
  job_id?: string;
}

export interface AnswerQuestionResponse {
  success: boolean;
  data: Answer;
  error?: string;
}

export interface FillApplicationRequest {
  form_fields: FormField[];
  user_id: string;
  job_id?: string;
}

export interface FillApplicationResponse {
  success: boolean;
  data: {
    answers: Answer[];
    overall_confidence: number;
  };
  error?: string;
}

export interface ApproveApplicationRequest {
  application_id: string;
  user_id: string;
  approved_answers: Answer[];
}

export interface ApproveApplicationResponse {
  success: boolean;
  data: {
    application_id: string;
    status: string;
  };
  error?: string;
}

// Error Types

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface FlashError {
  type: 'API_ERROR' | 'NETWORK_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR';
  message: string;
  statusCode?: number;
  data?: any;
}

// Authentication Types

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  confirmPassword: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: AuthSession;
  error?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  data?: AuthSession;
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  data?: {
    access_token: string;
    expires_at: string;
  };
  error?: string;
}

export interface AuthCheckResponse {
  success: boolean;
  data?: AuthUser;
  authenticated: boolean;
  error?: string;
}
