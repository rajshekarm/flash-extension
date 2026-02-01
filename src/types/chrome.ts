// Chrome Extension specific types

// Message types for chrome.runtime.sendMessage
export enum MessageType {
  // Detection events
  FORM_DETECTED = 'FORM_DETECTED',
  JOB_DETECTED = 'JOB_DETECTED',
  PAGE_ANALYZED = 'PAGE_ANALYZED',

  // Action requests
  ANALYZE_JOB = 'ANALYZE_JOB',
  TAILOR_RESUME = 'TAILOR_RESUME',
  ANSWER_QUESTION = 'ANSWER_QUESTION',
  FILL_APPLICATION = 'FILL_APPLICATION',
  SUBMIT_APPLICATION = 'SUBMIT_APPLICATION',

  // Injection commands
  INJECT_ANSWERS = 'INJECT_ANSWERS',
  INJECT_FIELD = 'INJECT_FIELD',
  CLEAR_FIELDS = 'CLEAR_FIELDS',

  // Response events
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  ANSWERS_READY = 'ANSWERS_READY',
  INJECTION_COMPLETE = 'INJECTION_COMPLETE',
  OPERATION_SUCCESS = 'OPERATION_SUCCESS',

  // Error events
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INJECTION_ERROR = 'INJECTION_ERROR',

  // State queries
  GET_STATE = 'GET_STATE',
  GET_USER_PROFILE = 'GET_USER_PROFILE',
  GET_CURRENT_JOB = 'GET_CURRENT_JOB',
  GET_FORM_STATE = 'GET_FORM_STATE',
  GET_FORMS = 'GET_FORMS',
  GET_JOB_INFO = 'GET_JOB_INFO',

  // Content script queries
  PING = 'PING',
  DETECT_FORMS = 'DETECT_FORMS',
  EXTRACT_JOB = 'EXTRACT_JOB',
  CLEAR_HIGHLIGHTS = 'CLEAR_HIGHLIGHTS',

  // State updates
  UPDATE_USER_PROFILE = 'UPDATE_USER_PROFILE',
  UPDATE_PREFERENCES = 'UPDATE_PREFERENCES',
  CLEAR_SESSION = 'CLEAR_SESSION',

  // UI events
  OPEN_SIDEPANEL = 'OPEN_SIDEPANEL',
  CLOSE_SIDEPANEL = 'CLOSE_SIDEPANEL',
  OPEN_OPTIONS = 'OPEN_OPTIONS',
  UPDATE_BADGE = 'UPDATE_BADGE',
}

export interface Message<T = any> {
  type: MessageType;
  payload?: T;
  tabId?: number;
  timestamp?: number;
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Storage types

export interface StorageKeys {
  // User data (sync storage)
  userProfile: 'userProfile';
  apiSettings: 'apiSettings';
  preferences: 'preferences';

  // Session data (local storage)
  currentSession: 'currentSession';
  formCache: 'formCache';
  recentJobs: 'recentJobs';
  answersCache: 'answersCache';

  // Tab-specific (session storage)
  activeTab: 'activeTab';
  detectionState: 'detectionState';
}

export interface StorageData {
  userProfile?: import('./flash').UserProfile;
  apiSettings?: APISettings;
  preferences?: UserPreferences;
  currentSession?: Session;
  formCache?: FormCache[];
  recentJobs?: RecentJob[];
  answersCache?: AnswerCache[];
  activeTab?: TabInfo;
  detectionState?: DetectionState;
}

export interface APISettings {
  baseURL: string;
  apiKey: string;
  timeout: number;
  connected: boolean;
  lastChecked?: string;
}

export interface UserPreferences {
  autoAnalyze: boolean;
  autoFill: boolean;
  minConfidence: number;
  highlightFilled: boolean;
  enableNotifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface Session {
  id: string;
  startedAt: string;
  currentTab?: TabInfo;
  currentJob?: import('./flash').JobAnalysis;
  currentForm?: FormCache;
  status: 'idle' | 'analyzing' | 'filling' | 'reviewing' | 'complete';
}

export interface FormCache {
  url: string;
  formData: import('./form').FormMetadata;
  answers?: import('./flash').Answer[];
  cachedAt: string;
  expiresAt: string;
}

export interface RecentJob {
  id: string;
  title: string;
  company: string;
  url: string;
  appliedAt: string;
  status: 'draft' | 'submitted' | 'rejected' | 'interview';
}

export interface AnswerCache {
  questionHash: string;
  question: string;
  answer: string;
  confidence: number;
  cachedAt: string;
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  domain: string;
  isJobBoard: boolean;
  hasForm: boolean;
}

export interface DetectionState {
  tabId: number;
  formsDetected: number;
  jobDetected: boolean;
  lastScan: string;
  status: 'idle' | 'scanning' | 'detected' | 'error';
}

// Badge state

export interface BadgeState {
  text: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  tooltip?: string;
}

// Side panel state

export type WorkflowStep = 'detection' | 'analysis' | 'tailoring' | 'review' | 'submission';

export interface SidePanelState {
  open: boolean;
  currentStep: WorkflowStep;
  canProgress: boolean;
}

// Context menu

export interface ContextMenuOptions {
  id: string;
  title: string;
  contexts: chrome.contextMenus.ContextType[];
  onclick?: (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void;
}

// Permissions

export interface ExtensionPermissions {
  storage: boolean;
  activeTab: boolean;
  scripting: boolean;
  notifications?: boolean;
  clipboardWrite?: boolean;
}

// Runtime error

export interface RuntimeError {
  code: string;
  message: string;
  context?: string;
  stack?: string;
  timestamp: string;
}
