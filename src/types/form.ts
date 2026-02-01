// Form-related types for DOM interaction

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'date'
  | 'time'
  | 'datetime'
  | 'month'
  | 'week'
  | 'color'
  | 'range'
  | 'hidden'
  | 'password';

export interface DetectedFormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  element: HTMLElement;
  required: boolean;
  placeholder?: string;
  options?: SelectOption[];
  value?: string;
  validation?: FieldValidation;
  attributes: Record<string, string>;
}

export interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface FieldValidation {
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

export interface DetectedForm {
  element: HTMLFormElement;
  action?: string;
  method?: string;
  fields: DetectedFormField[];
  submitButton?: HTMLButtonElement;
  score: number; // Confidence that this is an application form
}

export interface FormMetadata {
  url: string;
  domain: string;
  title: string;
  company?: string;
  detectedAt: string;
  forms: DetectedForm[];
}

export interface InjectionResult {
  fieldId: string;
  success: boolean;
  value?: string;
  error?: string;
}

export interface FormFillingStatus {
  total: number;
  filled: number;
  failed: number;
  skipped: number;
  results: InjectionResult[];
}

// Job extraction types

export interface ExtractedJobInfo {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  jobType?: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  postedDate?: string;
  url: string;
}

export interface JobBoardPattern {
  domain: string;
  name: string;
  selectors: {
    title?: string[];
    company?: string[];
    location?: string[];
    description?: string[];
    requirements?: string[];
    applyButton?: string[];
  };
}

// Field classification

export interface FieldClassification {
  category: FieldCategory;
  confidence: number;
  reasoning: string;
}

export type FieldCategory =
  | 'personal_info' // name, email, phone
  | 'contact_info' // address, city, state, zip
  | 'professional_links' // LinkedIn, GitHub, Portfolio
  | 'work_history' // company, title, dates
  | 'education' // school, degree, major
  | 'skills' // technical skills, languages
  | 'documents' // resume, cover letter, references
  | 'questions' // essay questions, motivation
  | 'preferences' // salary, start date, relocation
  | 'legal' // work authorization, background check
  | 'other';

export interface ClassifiedField extends DetectedFormField {
  classification: FieldClassification;
}

// Form detection scoring

export interface FormScore {
  isApplicationForm: boolean;
  score: number;
  reasons: string[];
  indicators: {
    hasResumeUpload: boolean;
    hasTextArea: boolean;
    hasWorkHistory: boolean;
    hasKeywords: boolean;
    fieldCount: number;
  };
}
