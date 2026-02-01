# Flash Extension - Design Specification

## Executive Summary

Flash Chrome Extension is the frontend interface for the AI Job Application Assistant. It detects job postings and application forms, communicates with the Atlas Flash backend, and provides an intelligent auto-fill experience with human oversight.

---

## 1. Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Popup     │  │  Side Panel  │  │  Content Script  │   │
│  │   (React)   │  │   (React)    │  │   (Detection)    │   │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬────────┘   │
│         │                 │                     │             │
│         └─────────────────┴─────────────────────┘             │
│                           │                                   │
│                  ┌────────▼────────┐                         │
│                  │  Background     │                         │
│                  │  Service Worker │                         │
│                  └────────┬────────┘                         │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTP/REST
                   ┌────────▼────────┐
                   │  Atlas Backend  │
                   │  Flash Service  │
                   │  (FastAPI)      │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  Azure OpenAI   │
                   │  + Vector DB    │
                   └─────────────────┘
```

### Component Responsibilities

#### Content Script
- **Purpose**: Interact with web page DOM
- **Responsibilities**:
  - Detect job application forms
  - Extract job descriptions
  - Identify form fields
  - Inject answers into fields
  - Monitor page changes
- **Injection**: Only on job board domains
- **Communication**: Messages to background script

#### Background Service Worker
- **Purpose**: Central message hub & API communication
- **Responsibilities**:
  - Handle API requests to Atlas backend
  - Manage authentication state
  - Store user profile data
  - Route messages between components
  - Handle extension lifecycle
- **Persistent**: No (Manifest V3)
- **Communication**: Chrome runtime messaging

#### Popup
- **Purpose**: Quick access interface
- **Responsibilities**:
  - Show current page status
  - Trigger job analysis
  - Quick form fill actions
  - Access settings
- **Size**: 400x600px
- **Communication**: Messages to background

#### Side Panel
- **Purpose**: Main workflow interface
- **Responsibilities**:
  - Display job analysis
  - Show form fields with answers
  - Answer review and editing
  - Resume preview
  - Submission confirmation
- **Size**: 400px width, full height
- **Communication**: Messages to background

#### Options Page
- **Purpose**: Settings and configuration
- **Responsibilities**:
  - User profile management
  - API configuration
  - Preferences
  - Application history
  - Analytics
- **Access**: chrome://extensions or popup link

---

## 2. User Flows

### Flow 1: First-Time Setup

```
User installs extension
    ↓
Opens options page
    ↓
Creates/links profile
    ↓
Uploads master resume
    ↓
Configures preferences
    ↓
Ready to use
```

### Flow 2: Job Analysis

```
User visits job posting
    ↓
Extension detects job page
    ↓
Shows "Analyze Job" badge
    ↓
User clicks popup → Analyze
    ↓
Extracts job description
    ↓
Sends to Flash API
    ↓
Displays analysis in side panel:
  - Required skills
  - Match score
  - Key requirements
  - "Tailor Resume" button
```

### Flow 3: Form Auto-Fill

```
User clicks "Apply" on job posting
    ↓
Extension detects application form
    ↓
Shows notification: "Form detected"
    ↓
User opens side panel
    ↓
Extension shows detected fields
    ↓
User clicks "Fill Application"
    ↓
Background sends fields to Flash API
    ↓
API returns answers with confidence scores
    ↓
Side panel shows review interface:
  - Each field with suggested answer
  - Confidence indicator
  - Edit button
  - Data source
    ↓
User reviews and edits answers
    ↓
User clicks "Apply Answers"
    ↓
Extension injects answers into form
    ↓
User submits form manually
    ↓
Extension logs application
```

### Flow 4: Resume Tailoring

```
User on job posting
    ↓
Clicks "Tailor Resume" in side panel
    ↓
Flash API generates tailored resume
    ↓
Shows diff preview
    ↓
User reviews changes
    ↓
User approves
    ↓
Downloads tailored resume PDF
    ↓
Can upload to form or save for later
```

---

## 3. UI/UX Design

### Design Principles
1. **Transparency** - Always show confidence scores and data sources
2. **Control** - User approval required for all actions
3. **Simplicity** - Minimal clicks to accomplish tasks
4. **Trust** - Clear indicators of AI vs. user content
5. **Speed** - Fast interactions, background processing

### Color Scheme
```css
/* Primary Colors */
--primary: #3B82F6      /* Blue - action buttons */
--primary-dark: #2563EB
--primary-light: #DBEAFE

/* Status Colors */
--success: #10B981      /* Green - high confidence */
--warning: #F59E0B      /* Amber - medium confidence */
--danger: #EF4444       /* Red - low confidence */

/* Neutral Colors */
--background: #FFFFFF
--surface: #F9FAFB
--border: #E5E7EB
--text: #111827
--text-secondary: #6B7280
```

### Typography
- **Font Family**: Inter (system fallback: -apple-system, sans-serif)
- **Sizes**: 
  - Heading: 20px, 16px, 14px
  - Body: 14px
  - Small: 12px

### Components Library

#### Confidence Score Badge
```tsx
<ConfidenceBadge score={0.85}>
  {/* High: Green, Medium: Amber, Low: Red */}
</ConfidenceBadge>
```

#### Answer Card
```tsx
<AnswerCard
  question="Years of experience with Python?"
  answer="5 years"
  confidence={0.92}
  source="Resume - Work Experience"
  onEdit={() => {}}
/>
```

#### Form Field Item
```tsx
<FormFieldItem
  label="Position applied for"
  type="text"
  value="Senior Backend Engineer"
  confidence={0.95}
  isEditing={false}
  onEdit={() => {}}
  onSave={() => {}}
/>
```

---

## 4. Technical Specifications

### Tech Stack

```json
{
  "framework": "Plasmo 0.84+",
  "language": "TypeScript 5.0+",
  "ui": "React 18+",
  "styling": "Tailwind CSS 3.3+",
  "bundler": "Parcel (via Plasmo)",
  "state": "Zustand 4.4+",
  "api": "Axios 1.6+",
  "testing": {
    "unit": "Vitest",
    "e2e": "Playwright"
  }
}
```

### Manifest V3 Configuration

```typescript
// plasmo.config.ts
export default {
  manifest: {
    host_permissions: [
      "https://www.linkedin.com/*",
      "https://www.indeed.com/*",
      "https://jobs.lever.co/*",
      "https://boards.greenhouse.io/*",
      "https://*.workday.com/*"
    ],
    permissions: [
      "activeTab",
      "storage",
      "sidePanel",
      "scripting"
    ],
    background: {
      service_worker: "background/index.ts"
    }
  }
}
```

### Chrome Storage Schema

```typescript
interface StorageSchema {
  // User Profile
  user: {
    userId: string
    fullName: string
    email: string
    currentTitle: string
    yearsOfExperience: number
    skills: string[]
    resumePath: string
  }
  
  // API Configuration
  config: {
    apiUrl: string
    apiKey?: string
    autoAnalyze: boolean
    confidenceThreshold: number // 0-1
  }
  
  // Cached Job Analyses
  jobAnalyses: {
    [jobUrl: string]: {
      analysis: JobAnalysis
      timestamp: number
    }
  }
  
  // Draft Applications
  drafts: {
    [applicationId: string]: {
      jobId: string
      fields: FilledField[]
      savedAt: number
    }
  }
  
  // Application History
  history: ApplicationLog[]
}
```

### API Client

```typescript
// src/lib/api/client.ts
class FlashApiClient {
  private baseUrl: string
  private apiKey?: string
  
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }
  
  async analyzeJob(jobDescription: JobDescription): Promise<JobAnalysis> {
    return this.post('/api/flash/analyze-job', { job_description: jobDescription })
  }
  
  async fillApplication(request: FillApplicationRequest): Promise<ApplicationReview> {
    return this.post('/api/flash/fill-application', request)
  }
  
  async tailorResume(request: TailorResumeRequest): Promise<ResumeTailoringResponse> {
    return this.post('/api/flash/tailor-resume', request)
  }
  
  private async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'X-API-Key': this.apiKey })
      }
    })
    return response.data
  }
}
```

---

## 5. Form Detection Strategy

### Target Job Boards

**Priority 1** (80% of applications):
- LinkedIn Jobs
- Indeed
- Greenhouse
- Lever
- Workday

**Priority 2**:
- Company career pages
- iCIMS
- Taleo
- SmartRecruiters

### Detection Algorithm

```typescript
class FormDetector {
  detectApplicationForm(): FormDetectionResult | null {
    // 1. Look for form element
    const form = this.findApplicationForm()
    if (!form) return null
    
    // 2. Extract fields
    const fields = this.extractFields(form)
    
    // 3. Classify field types
    const classifiedFields = fields.map(field => ({
      ...field,
      type: this.classifyFieldType(field),
      semanticType: this.inferSemanticType(field) // "name", "email", "experience", etc.
    }))
    
    // 4. Detect multi-step
    const steps = this.detectMultiStep(form)
    
    return {
      formId: this.generateFormId(form),
      fields: classifiedFields,
      isMultiStep: steps.length > 1,
      steps
    }
  }
  
  private inferSemanticType(field: FormField): string {
    const label = field.label.toLowerCase()
    
    // Pattern matching
    if (label.includes('name')) return 'name'
    if (label.includes('email')) return 'email'
    if (label.includes('phone')) return 'phone'
    if (label.includes('experience')) return 'experience'
    if (label.includes('education')) return 'education'
    // ... more patterns
    
    return 'general'
  }
}
```

### Field Type Classification

```typescript
enum FieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  EMAIL = 'email',
  PHONE = 'phone',
  NUMBER = 'number',
  DATE = 'date',
  DROPDOWN = 'dropdown',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  FILE = 'file'
}

enum SemanticType {
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  EMAIL = 'email',
  PHONE = 'phone',
  LOCATION = 'location',
  LINKEDIN = 'linkedin',
  GITHUB = 'github',
  PORTFOLIO = 'portfolio',
  EXPERIENCE_YEARS = 'experienceYears',
  CURRENT_TITLE = 'currentTitle',
  DESIRED_SALARY = 'desiredSalary',
  START_DATE = 'startDate',
  WORK_AUTHORIZATION = 'workAuthorization',
  COVER_LETTER = 'coverLetter',
  WHY_INTERESTED = 'whyInterested',
  GENERAL = 'general'
}
```

---

## 6. Job Description Extraction

### Extraction Strategy

```typescript
class JobExtractor {
  extractJobDescription(pageUrl: string): JobDescription | null {
    // Platform-specific extractors
    if (pageUrl.includes('linkedin.com')) {
      return this.extractLinkedIn()
    } else if (pageUrl.includes('indeed.com')) {
      return this.extractIndeed()
    } else if (pageUrl.includes('greenhouse.io')) {
      return this.extractGreenhouse()
    } else {
      return this.extractGeneric()
    }
  }
  
  private extractLinkedIn(): JobDescription {
    return {
      title: document.querySelector('.job-title')?.textContent,
      company: document.querySelector('.company-name')?.textContent,
      location: document.querySelector('.location')?.textContent,
      description: document.querySelector('.job-description')?.textContent,
      url: window.location.href
    }
  }
  
  private extractGeneric(): JobDescription {
    // Fallback: use common patterns and heuristics
    const description = this.findLargestTextBlock()
    const title = this.findJobTitle()
    
    return {
      title,
      company: this.extractCompanyName(),
      description,
      url: window.location.href
    }
  }
}
```

---

## 7. Message Passing

### Architecture

```typescript
// Content Script → Background
chrome.runtime.sendMessage({
  type: 'ANALYZE_JOB',
  payload: { jobDescription }
})

// Background → Content Script
chrome.tabs.sendMessage(tabId, {
  type: 'INJECT_ANSWER',
  payload: { fieldId, answer }
})

// Popup/SidePanel → Background
chrome.runtime.sendMessage({
  type: 'GET_USER_PROFILE'
})
```

### Message Types

```typescript
enum MessageType {
  // Job Analysis
  ANALYZE_JOB = 'ANALYZE_JOB',
  JOB_ANALYZED = 'JOB_ANALYZED',
  
  // Form Detection
  DETECT_FORM = 'DETECT_FORM',
  FORM_DETECTED = 'FORM_DETECTED',
  
  // Auto-Fill
  FILL_APPLICATION = 'FILL_APPLICATION',
  INJECT_ANSWER = 'INJECT_ANSWER',
  ANSWERS_INJECTED = 'ANSWERS_INJECTED',
  
  // User Profile
  GET_USER_PROFILE = 'GET_USER_PROFILE',
  UPDATE_USER_PROFILE = 'UPDATE_USER_PROFILE',
  
  // Resume
  TAILOR_RESUME = 'TAILOR_RESUME',
  RESUME_TAILORED = 'RESUME_TAILORED',
  
  // State
  GET_CURRENT_STATE = 'GET_CURRENT_STATE',
  STATE_UPDATED = 'STATE_UPDATED'
}
```

---

## 8. Security & Privacy

### Data Handling
- **User profile**: Stored locally in Chrome storage (encrypted)
- **API credentials**: Stored securely, never logged
- **Form data**: Sent to backend only with user approval
- **Job descriptions**: Cached locally for 24 hours
- **Application history**: Optional, can be disabled

### Permissions Justification
- `activeTab`: Access current tab for form detection
- `storage`: Save user preferences and cache
- `sidePanel`: Display side panel UI
- `scripting`: Inject content scripts for auto-fill
- `host_permissions`: Access specific job board sites

### API Security
- HTTPS only
- Optional API key authentication
- Request rate limiting
- Token expiration handling
- No sensitive data in URLs

---

## 9. Error Handling

### Error Categories

```typescript
enum ErrorType {
  NETWORK_ERROR = 'Network request failed',
  API_ERROR = 'Backend API error',
  DETECTION_ERROR = 'Could not detect form',
  INJECTION_ERROR = 'Could not inject answer',
  AUTH_ERROR = 'Authentication failed',
  VALIDATION_ERROR = 'Invalid data'
}

class ErrorHandler {
  handle(error: Error, context: string) {
    // Log error
    console.error(`[${context}]`, error)
    
    // Show user-friendly message
    this.showNotification({
      type: 'error',
      message: this.getUserMessage(error),
      action: this.getSuggestedAction(error)
    })
    
    // Report to analytics (if enabled)
    this.reportError(error, context)
  }
}
```

### Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries exceeded')
}
```

---

## 10. Performance Optimization

### Bundle Size
- Target: < 500KB total
- Code splitting by route
- Lazy load content scripts
- Tree-shake unused code

### Runtime Performance
- Debounce form detection (300ms)
- Throttle scroll listeners
- Use IntersectionObserver for visibility
- Cache DOM queries
- Minimize re-renders

### API Optimization
- Cache job analyses (24h)
- Batch field requests when possible
- Compress request payloads
- Use HTTP/2 multiplexing

---

## 11. Testing Strategy

### Unit Tests (Vitest)
```typescript
// Form detection
describe('FormDetector', () => {
  it('should detect LinkedIn application form', () => {
    // ...
  })
  
  it('should classify field types correctly', () => {
    // ...
  })
})

// API client
describe('FlashApiClient', () => {
  it('should handle network errors', () => {
    // ...
  })
})
```

### Integration Tests
```typescript
// Chrome storage
describe('Storage Integration', () => {
  it('should save and retrieve user profile', async () => {
    await storage.set({ user: mockUser })
    const user = await storage.get('user')
    expect(user).toEqual(mockUser)
  })
})
```

### E2E Tests (Playwright)
```typescript
test('full application flow', async ({ page, context }) => {
  // Load extension
  await context.addExtension('./build/chrome-mv3-dev')
  
  // Navigate to job posting
  await page.goto('https://www.linkedin.com/jobs/view/123')
  
  // Analyze job
  await page.click('[data-test="analyze-job"]')
  
  // Fill application
  await page.click('[data-test="fill-application"]')
  
  // Verify answers injected
  expect(await page.inputValue('#name')).toBe('John Doe')
})
```

---

## 12. Deployment Checklist

### Pre-Launch
- [ ] Complete testing on major job boards
- [ ] Verify API integration with production backend
- [ ] Review and optimize bundle size
- [ ] Test on multiple Chrome versions
- [ ] Prepare marketing materials (screenshots, description)
- [ ] Set up analytics (privacy-compliant)
- [ ] Create demo video

### Chrome Web Store Submission
- [ ] Create developer account
- [ ] Prepare store listing
  - Extension name: "Flash - AI Job Application Assistant"
  - Description: 300 words
  - Screenshots: 1280x800 or 640x400 (5 images)
  - Category: Productivity
  - Privacy policy URL
- [ ] Upload extension package
- [ ] Request review
- [ ] Wait for approval (typically 1-3 days)

### Post-Launch
- [ ] Monitor user reviews
- [ ] Track error reports
- [ ] Collect feedback
- [ ] Plan updates

---

## 13. Future Enhancements

### Phase 2 Features
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Interview scheduling integration
- [ ] Application tracking dashboard
- [ ] Email notifications
- [ ] Browser sync across devices

### Advanced Features
- [ ] AI-powered cover letter generation
- [ ] Interview question preparation
- [ ] Salary negotiation insights
- [ ] Company research integration
- [ ] Network referral suggestions

---

## Summary

This design provides:
✅ **Complete architecture** for Chrome extension  
✅ **Plasmo framework** integration  
✅ **Separate project structure** (outside Atlas)  
✅ **Detailed requirements** (10 core areas)  
✅ **User flows** for all major features  
✅ **Technical specifications** ready for implementation  
✅ **Security & privacy** considerations  
✅ **Testing strategy** for quality assurance  
✅ **Deployment plan** for Chrome Web Store  

**Next Steps**: Initialize Plasmo project and start Phase 1 development!
