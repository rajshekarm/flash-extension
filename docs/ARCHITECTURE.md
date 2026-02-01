# Flash Extension - Architecture Document

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Component Architecture](#component-architecture)
4. [Communication Patterns](#communication-patterns)
5. [Data Flow](#data-flow)
6. [State Management](#state-management)
7. [Security Architecture](#security-architecture)
8. [Extension Lifecycle](#extension-lifecycle)
9. [API Integration](#api-integration)
10. [DOM Interaction Strategy](#dom-interaction-strategy)
11. [Performance Considerations](#performance-considerations)
12. [Error Handling](#error-handling)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Chrome Browser                               │
│                                                                       │
│  ┌──────────────┐     ┌───────────────┐     ┌──────────────────┐   │
│  │   Popup UI   │     │  Side Panel   │     │  Options Page    │   │
│  │   (React)    │     │    (React)    │     │    (React)       │   │
│  └──────┬───────┘     └───────┬───────┘     └────────┬─────────┘   │
│         │                     │                       │             │
│         │    ┌────────────────┴───────────────┐      │             │
│         │    │                                 │      │             │
│         └────┤  Background Service Worker      │◄─────┘             │
│              │  (Message Hub & API Gateway)    │                    │
│              └────────┬────────────────────────┘                    │
│                       │                    ▲                         │
│                       │                    │                         │
│              ┌────────▼────────┐    ┌──────┴────────┐              │
│              │  Chrome Storage │    │ Content Script │              │
│              │   (IndexedDB)   │    │ (DOM Monitor)  │              │
│              └─────────────────┘    └────────────────┘              │
│                                            │                         │
└────────────────────────────────────────────┼─────────────────────────┘
                                             │ Observes & Manipulates
                                             ▼
                                    ┌─────────────────┐
                                    │  Job Board DOM  │
                                    │  (LinkedIn,     │
                                    │   Greenhouse)   │
                                    └─────────────────┘
                                             │
                       ┌─────────────────────┘
                       │ HTTP/REST (via Background)
                       ▼
              ┌─────────────────────┐
              │  Atlas Backend API   │
              │    (FastAPI)         │
              └──────────┬───────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
         ┌────▼─────┐        ┌─────▼─────┐
         │  Azure   │        │   Azure   │
         │ OpenAI   │        │ AI Search │
         └──────────┘        └───────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Plasmo 0.84+ | Extension development framework |
| UI | React 18 + TypeScript | Component-based UI |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| State Management | Zustand 4.4 | Lightweight state |
| HTTP Client | Axios 1.6 | API communication |
| Storage | @plasmohq/storage | Chrome Storage wrapper |
| Messaging | @plasmohq/messaging | Chrome messaging abstraction |
| Build Tool | Plasmo Build System | Webpack-based bundler |
| Type System | TypeScript 5.3 | Type safety |
| Testing | Vitest + Playwright | Unit & E2E testing |

---

## Architecture Principles

### 1. **Separation of Concerns**
- UI components are isolated from business logic
- DOM manipulation separated from data processing
- API layer abstracted from components

### 2. **Single Responsibility**
- Each component has one clear purpose
- Content scripts only handle DOM
- Background handles API and coordination

### 3. **Unidirectional Data Flow**
```
User Action → Message → Background → API → Response → State Update → UI Render
```

### 4. **Fail-Safe Design**
- Graceful degradation when backend unavailable
- User can always edit/override AI suggestions
- No automatic submission without approval

### 5. **Privacy First**
- Minimal data storage in browser
- No sensitive data logged
- All data encrypted in transit

---

## Component Architecture

### Background Service Worker

**Purpose**: Central coordinator and API gateway

```typescript
// Architecture Pattern
class BackgroundOrchestrator {
  - messageRouter: MessageRouter
  - apiClient: FlashAPIClient
  - storageManager: StorageManager
  - authManager: AuthManager
  
  + handleMessage(message, sender)
  + routeToAPI(endpoint, data)
  + manageState()
  + handleErrors()
}
```

**Key Responsibilities**:
1. **Message Routing**: Receive and route messages from popup/content/sidepanel
2. **API Gateway**: All HTTP requests go through background
3. **State Coordination**: Manage global application state
4. **Authentication**: Handle API keys and tokens
5. **Storage**: Persist user data and preferences

**Message Handlers**:
```typescript
// src/background/messages/
├── analyzeJob.ts       → POST /api/flash/analyze-job
├── tailorResume.ts     → POST /api/flash/tailor-resume
├── answerQuestion.ts   → POST /api/flash/answer-question
├── fillApplication.ts  → POST /api/flash/fill-application
└── submitApplication.ts → POST /api/flash/approve-application
```

**Lifecycle**:
```
Install → onInstalled → Initialize storage
Runtime → onStartup → Restore state
Message → onMessage → Route to handler
```

---

### Content Scripts

**Purpose**: DOM observation and manipulation

```typescript
// Architecture Pattern
class ContentScriptOrchestrator {
  - formDetector: FormDetector
  - jobExtractor: JobExtractor
  - fieldInjector: FieldInjector
  - domObserver: MutationObserver
  
  + detectForms()
  + extractJobInfo()
  + injectAnswers(fields, answers)
  + observeChanges()
}
```

**Injection Strategy**:
```typescript
// Conditional injection based on URL patterns
const SUPPORTED_DOMAINS = [
  'linkedin.com/jobs',
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'indeed.com',
  'glassdoor.com'
];

// Only inject on matching domains
if (matchesDomain(window.location.href)) {
  initContentScript();
}
```

**Detection Algorithm**:
```
1. Scan DOM for <form> elements
2. Identify fields: input, textarea, select
3. Classify by type: text, email, phone, file
4. Extract labels and required status
5. Generate field metadata
6. Send to background for processing
```

**Injection Algorithm**:
```
1. Receive answers from background
2. Match field IDs with answer keys
3. For each field:
   - Text input → Set value
   - Select → Choose option
   - Radio → Check appropriate button
   - Checkbox → Toggle state
   - File → Trigger file picker
4. Dispatch input/change events
5. Validate filled data
6. Highlight filled fields
```

---

### Popup Interface

**Purpose**: Quick access and status display

```typescript
// Component Hierarchy
PopupApp
├── Header (logo, status indicator)
├── JobDetectionStatus
│   ├── JobTitle
│   ├── FieldCount
│   └── AnalysisStatus
├── ActionButtons
│   ├── AnalyzeJobButton
│   ├── FillFormButton
│   └── OpenSidePanelButton
└── Footer (settings link)
```

**State Management**:
```typescript
interface PopupState {
  currentTab: TabInfo;
  jobDetected: boolean;
  formFields: FormField[];
  analysisStatus: 'idle' | 'analyzing' | 'complete';
  apiConnected: boolean;
}
```

**Dimensions**: 400px × 600px (Chrome standard)

---

### Side Panel Interface

**Purpose**: Main workflow and review interface

```typescript
// Component Hierarchy
SidePanelApp
├── ProgressTracker (4 steps)
│   ├── JobAnalysis ✓
│   ├── ResumeTailoring ✓
│   ├── AnswerReview → (current)
│   └── Submission
├── JobSummary
│   ├── Title, Company
│   └── KeyRequirements
├── AnswersList
│   ├── AnswerCard (for each field)
│   │   ├── Question
│   │   ├── GeneratedAnswer
│   │   ├── ConfidenceScore
│   │   ├── EditButton
│   │   └── ApproveButton
└── ActionFooter
    ├── FillAllButton
    └── ReviewSubmitButton
```

**State Management**:
```typescript
interface SidePanelState {
  currentStep: 'analysis' | 'tailoring' | 'review' | 'submit';
  jobAnalysis: JobAnalysis;
  tailoredResume: Resume;
  answers: AnswerWithConfidence[];
  approvedAnswers: Set<string>;
}
```

---

### Options Page

**Purpose**: Configuration and preferences

```typescript
// Component Hierarchy
OptionsApp
├── Tabs
│   ├── ProfileTab
│   │   ├── BasicInfo (name, email, phone)
│   │   ├── Experience (jobs, education)
│   │   └── Skills (technical, soft skills)
│   ├── APITab
│   │   ├── BackendURL
│   │   ├── APIKey
│   │   └── ConnectionTest
│   ├── PreferencesTab
│   │   ├── AutoFillSettings
│   │   ├── ConfidenceThreshold
│   │   └── NotificationPreferences
│   └── HistoryTab
│       ├── ApplicationsList
│       └── Analytics
```

---

## Communication Patterns

### Message Passing Architecture

**Chrome Extension Messaging**:
```typescript
// Pattern 1: Popup → Background
chrome.runtime.sendMessage({
  type: 'ANALYZE_JOB',
  payload: { jobUrl, jobDescription }
});

// Pattern 2: Content → Background
chrome.runtime.sendMessage({
  type: 'FORM_DETECTED',
  payload: { fields, url }
});

// Pattern 3: Background → Content
chrome.tabs.sendMessage(tabId, {
  type: 'INJECT_ANSWERS',
  payload: { answers }
});
```

**Plasmo Messaging Abstraction**:
```typescript
// src/background/messages/analyzeJob.ts
export const analyzeJob = async (req, res) => {
  const { jobDescription } = req.body;
  
  try {
    const analysis = await flashAPI.analyzeJob(jobDescription);
    res.send({ success: true, data: analysis });
  } catch (error) {
    res.send({ success: false, error: error.message });
  }
};
```

### Message Types

```typescript
// Message Type Registry
enum MessageType {
  // Detection Events
  FORM_DETECTED = 'FORM_DETECTED',
  JOB_DETECTED = 'JOB_DETECTED',
  
  // Action Requests
  ANALYZE_JOB = 'ANALYZE_JOB',
  TAILOR_RESUME = 'TAILOR_RESUME',
  FILL_APPLICATION = 'FILL_APPLICATION',
  
  // Response Events
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  ANSWERS_READY = 'ANSWERS_READY',
  INJECTION_COMPLETE = 'INJECTION_COMPLETE',
  
  // Error Events
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}
```

---

## Data Flow

### End-to-End Flow: Job Application

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User navigates to job posting                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Content Script detects form                                  │
│    - Scans DOM for <form> elements                              │
│    - Extracts field metadata                                    │
│    - Sends FORM_DETECTED message                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Background receives detection                                │
│    - Stores form metadata in state                              │
│    - Updates popup badge                                        │
│    - Notifies popup/sidepanel                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. User clicks "Analyze Job" in popup                           │
│    - Popup sends ANALYZE_JOB message                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Background calls Atlas API                                   │
│    POST /api/flash/analyze-job                                  │
│    {                                                             │
│      "job_description": { ... },                                │
│      "user_id": "user123"                                       │
│    }                                                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Atlas Backend processes                                      │
│    - Azure OpenAI analyzes job description                      │
│    - Extracts skills, requirements, seniority                   │
│    - Returns analysis                                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Background receives analysis                                 │
│    - Stores in state                                            │
│    - Sends ANALYSIS_COMPLETE to popup/sidepanel                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. User clicks "Fill Application"                               │
│    - Opens side panel                                           │
│    - Background sends FILL_APPLICATION request to API           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Atlas generates answers                                      │
│    POST /api/flash/fill-application                             │
│    - RAG retrieves context from user profile                    │
│    - OpenAI generates answers                                   │
│    - Returns answers with confidence scores                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. Side Panel displays answers                                 │
│     - Shows each answer with confidence                         │
│     - User reviews and edits                                    │
│     - User approves answers                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11. User clicks "Fill Form"                                     │
│     - Side panel sends approved answers to background           │
│     - Background sends INJECT_ANSWERS to content script         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 12. Content Script injects answers                              │
│     - Matches field IDs with answers                            │
│     - Sets values in DOM                                        │
│     - Dispatches events for form validation                     │
│     - Highlights filled fields                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 13. User reviews final form                                     │
│     - Makes manual edits if needed                              │
│     - Clicks Submit button (manual action)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Management

### Global State Architecture

```typescript
// Zustand Store Structure
interface AppState {
  // User State
  user: {
    id: string;
    profile: UserProfile;
    apiKey: string;
    isAuthenticated: boolean;
  };
  
  // Current Session State
  currentJob: {
    url: string;
    title: string;
    company: string;
    description: string;
    analysis: JobAnalysis | null;
  };
  
  // Form State
  currentForm: {
    detected: boolean;
    fields: FormField[];
    answers: Map<string, Answer>;
    approvedFields: Set<string>;
  };
  
  // UI State
  ui: {
    sidePanelOpen: boolean;
    currentStep: WorkflowStep;
    loading: boolean;
    error: string | null;
  };
  
  // Actions
  actions: {
    setUser: (user: User) => void;
    setJobAnalysis: (analysis: JobAnalysis) => void;
    setAnswers: (answers: Answer[]) => void;
    approveAnswer: (fieldId: string) => void;
    clearSession: () => void;
  };
}
```

### Storage Strategy

```typescript
// Chrome Storage Layers
interface StorageArchitecture {
  // Local Storage (Fast, Temporary)
  chrome.storage.local: {
    currentSession: Session;
    formCache: FormField[];
    recentJobs: Job[];
  };
  
  // Sync Storage (Synced across devices)
  chrome.storage.sync: {
    userProfile: UserProfile;
    preferences: Preferences;
    apiSettings: APISettings;
  };
  
  // Session Storage (Tab-specific)
  chrome.storage.session: {
    activeTab: TabInfo;
    detectionState: DetectionState;
  };
}
```

---

## Security Architecture

### Authentication Flow

```
1. User enters API key in Options page
2. Extension validates key with backend
3. Key stored encrypted in chrome.storage.sync
4. All API requests include key in Authorization header
5. Backend validates on each request
```

### Data Protection

```typescript
// Security Measures
const SecurityLayers = {
  // 1. Content Security Policy
  CSP: {
    'default-src': "'self'",
    'connect-src': ['https://your-atlas-backend.com'],
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'"
  },
  
  // 2. Storage Encryption
  storage: {
    encrypt: (data) => /* AES encryption */,
    decrypt: (data) => /* AES decryption */
  },
  
  // 3. API Communication
  api: {
    protocol: 'HTTPS only',
    auth: 'Bearer token',
    timeout: 30000
  },
  
  // 4. DOM Isolation
  contentScript: {
    world: 'ISOLATED',
    noDirectAccess: true
  }
};
```

### Permissions Model

```json
{
  "permissions": [
    "storage",          // Store user data
    "activeTab"         // Access current tab
  ],
  "host_permissions": [
    "https://linkedin.com/*",
    "https://greenhouse.io/*"
  ],
  "optional_permissions": [
    "clipboardWrite"    // Copy resume
  ]
}
```

---

## Extension Lifecycle

### Installation & Initialization

```typescript
// Background: onInstalled event
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First install
    await initializeStorage();
    await openWelcomePage();
  } else if (details.reason === 'update') {
    // Extension updated
    await migrateData(details.previousVersion);
  }
});
```

### Startup

```typescript
// Background: onStartup event
chrome.runtime.onStartup.addListener(async () => {
  // Restore state
  const savedState = await chrome.storage.local.get('state');
  appState.restore(savedState);
  
  // Validate API connection
  await testBackendConnection();
});
```

### Tab Change Handling

```typescript
// Monitor active tab changes
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  
  if (isJobBoardUrl(tab.url)) {
    // Inject content script if not already injected
    await injectContentScriptIfNeeded(tabId);
    
    // Update popup state
    await updatePopupForTab(tab);
  }
});
```

---

## API Integration

### API Client Architecture

```typescript
// src/lib/api/client.ts
class FlashAPIClient {
  private baseURL: string;
  private apiKey: string;
  private axiosInstance: AxiosInstance;
  
  constructor() {
    this.baseURL = process.env.PLASMO_PUBLIC_API_URL;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Request interceptor (add auth)
    this.axiosInstance.interceptors.request.use(
      (config) => {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
        return config;
      }
    );
    
    // Response interceptor (handle errors)
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => this.handleError(error)
    );
  }
  
  async analyzeJob(jobData: JobDescription): Promise<JobAnalysis> {
    const response = await this.axiosInstance.post(
      '/api/flash/analyze-job',
      { job_description: jobData }
    );
    return response.data;
  }
  
  async fillApplication(
    formFields: FormField[],
    userId: string
  ): Promise<ApplicationAnswers> {
    const response = await this.axiosInstance.post(
      '/api/flash/fill-application',
      { form_fields: formFields, user_id: userId }
    );
    return response.data;
  }
  
  private handleError(error: AxiosError): never {
    if (error.response) {
      // Server responded with error
      throw new APIError(error.response.status, error.response.data);
    } else if (error.request) {
      // No response received
      throw new NetworkError('Backend unreachable');
    } else {
      // Request setup error
      throw new Error(error.message);
    }
  }
}
```

### Error Handling Strategy

```typescript
// Error Hierarchy
class FlashError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

class APIError extends FlashError {
  constructor(public statusCode: number, public data: any) {
    super('API_ERROR', `API returned ${statusCode}`);
  }
}

class NetworkError extends FlashError {
  constructor(message: string) {
    super('NETWORK_ERROR', message);
  }
}

class ValidationError extends FlashError {
  constructor(public field: string, message: string) {
    super('VALIDATION_ERROR', message);
  }
}

// Error Recovery
const errorRecoveryStrategies = {
  NETWORK_ERROR: () => {
    // Retry with exponential backoff
    return retryWithBackoff(3, 1000);
  },
  API_ERROR: (error: APIError) => {
    if (error.statusCode === 401) {
      // Re-authenticate
      return promptForAPIKey();
    } else if (error.statusCode >= 500) {
      // Server error, retry
      return retryWithBackoff(2, 2000);
    }
  },
  VALIDATION_ERROR: (error: ValidationError) => {
    // Show user-friendly message
    return showValidationMessage(error.field, error.message);
  }
};
```

---

## DOM Interaction Strategy

### Form Detection Algorithm

```typescript
// src/lib/dom/formDetector.ts
class FormDetector {
  detect(): FormMetadata {
    // Step 1: Find all forms
    const forms = document.querySelectorAll('form');
    
    // Step 2: Identify application form
    const applicationForm = this.identifyApplicationForm(forms);
    
    if (!applicationForm) return null;
    
    // Step 3: Extract fields
    const fields = this.extractFields(applicationForm);
    
    // Step 4: Classify fields
    const classifiedFields = fields.map(this.classifyField);
    
    return {
      form: applicationForm,
      fields: classifiedFields,
      submitButton: this.findSubmitButton(applicationForm)
    };
  }
  
  private identifyApplicationForm(forms: NodeListOf<HTMLFormElement>) {
    // Heuristics to identify application form
    for (const form of forms) {
      const score = this.scoreForm(form);
      if (score > 0.7) return form;
    }
    return null;
  }
  
  private scoreForm(form: HTMLFormElement): number {
    let score = 0;
    
    // Check for application-related keywords
    const html = form.innerHTML.toLowerCase();
    if (html.includes('apply')) score += 0.3;
    if (html.includes('resume') || html.includes('cv')) score += 0.2;
    if (html.includes('experience')) score += 0.1;
    if (html.includes('education')) score += 0.1;
    
    // Check for file upload (resume)
    if (form.querySelector('input[type="file"]')) score += 0.3;
    
    // Check for textarea (cover letter)
    if (form.querySelectorAll('textarea').length > 0) score += 0.2;
    
    return Math.min(score, 1.0);
  }
  
  private classifyField(field: HTMLInputElement): ClassifiedField {
    // Classify by name/id/placeholder
    const identifiers = [
      field.name,
      field.id,
      field.placeholder,
      field.getAttribute('aria-label')
    ].join(' ').toLowerCase();
    
    return {
      element: field,
      type: this.determineType(identifiers, field.type),
      label: this.extractLabel(field),
      required: field.required || field.hasAttribute('required'),
      currentValue: field.value
    };
  }
  
  private determineType(identifiers: string, htmlType: string): FieldType {
    if (identifiers.includes('email')) return 'email';
    if (identifiers.includes('phone')) return 'phone';
    if (identifiers.includes('linkedin')) return 'linkedin_url';
    if (identifiers.includes('github')) return 'github_url';
    if (identifiers.includes('portfolio')) return 'portfolio_url';
    if (identifiers.includes('salary')) return 'salary';
    if (identifiers.includes('resume') || identifiers.includes('cv')) {
      return 'resume_upload';
    }
    if (htmlType === 'file') return 'file_upload';
    if (htmlType === 'textarea') return 'long_text';
    return 'text';
  }
}
```

### Answer Injection Algorithm

```typescript
// src/lib/dom/fieldInjector.ts
class FieldInjector {
  async injectAnswers(
    fields: ClassifiedField[],
    answers: Map<string, string>
  ): Promise<InjectionResult> {
    const results = [];
    
    for (const field of fields) {
      const answer = answers.get(field.id);
      if (!answer) continue;
      
      try {
        await this.injectField(field, answer);
        results.push({ field: field.id, success: true });
      } catch (error) {
        results.push({ field: field.id, success: false, error });
      }
    }
    
    return { results };
  }
  
  private async injectField(field: ClassifiedField, value: string) {
    const element = field.element;
    
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        await this.setInputValue(element, value);
        break;
        
      case 'textarea':
      case 'long_text':
        await this.setTextareaValue(element, value);
        break;
        
      case 'select':
        await this.setSelectValue(element, value);
        break;
        
      case 'radio':
        await this.setRadioValue(element, value);
        break;
        
      case 'checkbox':
        await this.setCheckboxValue(element, value);
        break;
        
      case 'file_upload':
        // Cannot programmatically upload - show instruction
        this.showFileUploadInstructions(element, value);
        break;
    }
    
    // Highlight filled field
    this.highlightField(element);
  }
  
  private async setInputValue(
    input: HTMLInputElement,
    value: string
  ) {
    // Set value
    input.value = value;
    
    // Dispatch events for React/Angular/Vue detection
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Some frameworks use custom events
    input.dispatchEvent(new Event('focusout', { bubbles: true }));
  }
  
  private highlightField(element: HTMLElement) {
    element.style.border = '2px solid #10B981';
    element.style.backgroundColor = '#D1FAE5';
    
    // Add data attribute for tracking
    element.setAttribute('data-flash-filled', 'true');
  }
}
```

---

## Performance Considerations

### Content Script Optimization

```typescript
// Lazy loading: Only initialize when needed
let detector: FormDetector | null = null;
let injector: FieldInjector | null = null;

function getDetector(): FormDetector {
  if (!detector) {
    detector = new FormDetector();
  }
  return detector;
}

// Debounce DOM observations
const observeDOM = debounce(() => {
  const forms = getDetector().detect();
  if (forms) {
    notifyBackgroundOfFormDetection(forms);
  }
}, 500);

// Use MutationObserver efficiently
const observer = new MutationObserver((mutations) => {
  // Only observe if likely to contain forms
  const hasRelevantChanges = mutations.some(
    (m) => m.type === 'childList' && m.addedNodes.length > 0
  );
  
  if (hasRelevantChanges) {
    observeDOM();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### Bundle Size Optimization

```typescript
// Code splitting
const PopupApp = lazy(() => import('./popup'));
const SidePanelApp = lazy(() => import('./sidepanel'));
const OptionsApp = lazy(() => import('./options'));

// Tree shaking
import { analyzeJob } from './lib/api/flash'; // Only import what's needed

// Dynamic imports
async function loadHeavyModule() {
  const module = await import('./heavy-module');
  return module.process();
}
```

### Caching Strategy

```typescript
// API Response Cache
class APICache {
  private cache = new Map<string, CacheEntry>();
  private TTL = 5 * 60 * 1000; // 5 minutes
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// Usage
const cache = new APICache();

async function analyzeJob(jobUrl: string) {
  const cached = cache.get(jobUrl);
  if (cached) return cached;
  
  const analysis = await api.analyzeJob(jobUrl);
  cache.set(jobUrl, analysis);
  return analysis;
}
```

---

## Error Handling

### Error Boundary Pattern

```typescript
// React Error Boundary
class FlashErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to background for analytics
    chrome.runtime.sendMessage({
      type: 'ERROR_LOG',
      payload: { error: error.toString(), stack: errorInfo }
    });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### Graceful Degradation

```typescript
// If backend unavailable, provide manual workflow
async function fillApplication(fields, userId) {
  try {
    // Try AI-powered fill
    return await api.fillApplication(fields, userId);
  } catch (error) {
    if (error instanceof NetworkError) {
      // Fallback: Show manual fill interface
      return showManualFillInterface(fields);
    }
    throw error;
  }
}
```

---

## Deployment Architecture

### Build Process

```bash
# Development build with HMR
pnpm dev

# Production build
pnpm build
  ↓
Plasmo Build System
  ├─ Transpile TypeScript
  ├─ Bundle with Webpack
  ├─ Process Tailwind CSS
  ├─ Optimize assets
  └─ Generate manifest.json
  ↓
build/chrome-mv3-prod/
  ├─ background.js
  ├─ content.js
  ├─ popup.html
  ├─ sidepanel.html
  ├─ options.html
  └─ manifest.json

# Package for distribution
pnpm package
  ↓
flash-extension-0.1.0.zip
```

### Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Flash - AI Job Application Assistant",
  "version": "0.1.0",
  "description": "AI-powered job application assistant",
  
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  
  "host_permissions": [
    "https://linkedin.com/*",
    "https://greenhouse.io/*",
    "https://lever.co/*",
    "https://workday.com/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [
    {
      "matches": [
        "https://linkedin.com/jobs/*",
        "https://*.greenhouse.io/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },
  
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  
  "options_page": "options.html",
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Future Architecture Enhancements

### 1. **Offline Support**
- IndexedDB for local resume storage
- Service worker cache for API responses
- Queue failed requests for retry

### 2. **Multi-Resume Support**
- Profile switcher architecture
- Resume versioning
- Context-aware resume selection

### 3. **Analytics & Telemetry**
```typescript
interface AnalyticsArchitecture {
  events: {
    jobDetected: JobDetectedEvent;
    formFilled: FormFilledEvent;
    applicationSubmitted: ApplicationSubmittedEvent;
  };
  
  metrics: {
    successRate: number;
    averageConfidence: number;
    timeToFill: number;
  };
  
  storage: 'Azure Application Insights' | 'Local Analytics DB';
}
```

### 4. **Real-time Collaboration**
- WebSocket connection to backend
- Live answer suggestions
- Collaborative review mode

---

## Summary

The Flash Extension architecture is designed for:
- **Modularity**: Clear separation of concerns
- **Scalability**: Easy to add new job boards
- **Reliability**: Graceful degradation and error handling
- **Security**: Privacy-first design with encryption
- **Performance**: Lazy loading and caching
- **Maintainability**: Type-safe with comprehensive documentation

All components communicate through well-defined interfaces, making the system testable, extensible, and maintainable.
