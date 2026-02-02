# Flash Extension - File Execution Workflow

This document traces the exact file-by-file workflow when a user loads a Workday job page.

## 🔄 Complete Execution Flow

### **Step 1: Content Script Injection**
**File:** `src/content/index.tsx`

Chrome automatically injects the content script because the URL matches:
```typescript
export const config: PlasmoCSConfig = {
  matches: [
    "https://*.linkedin.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.myworkday.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.indeed.com/*",
    "https://*.glassdoor.com/*"
  ]
}
```

**What happens:**
- Content script mounts as a React component
- Initializes state for current job and detected forms
- Sets up mutation observer for dynamic content

---

### **Step 2: Initial Scan**
**File:** `src/content/index.tsx` (Lines 50-60)

On mount, `performInitialScan()` runs:
```typescript
const performInitialScan = async () => {
  // Check if this is a job page
  const jobInfo = extractJobInfo();
  if (jobInfo) {
    setCurrentJob(jobInfo);
    await storage.set("currentJob", jobInfo);
    
    // Notify background
    await sendToBackground({
      name: "job-detected",
      body: { jobInfo }
    });
  }
  
  // Detect application forms
  const forms = detectForms();
  if (forms.length > 0) {
    setDetectedForms(forms);
    await storage.set("detectedForms", forms);
  }
}
```

**What happens:**
- Calls job extraction library
- Calls form detection library
- Stores results in Chrome storage
- Notifies background script

---

### **Step 3: Job Detection**
**File:** `src/lib/dom/jobExtractor.ts` (Lines 60-80)

```typescript
export const extractJobInfo = (): JobInfo | null => {
  const hostname = window.location.hostname;
  
  // Find matching job board pattern
  const pattern = JOB_BOARD_PATTERNS.find(p => 
    p.domains.some(domain => hostname.includes(domain))
  );
  
  if (!pattern) return null;
  
  // Extract job details using platform-specific selectors
  const title = querySelector(pattern.selectors.title);
  const company = querySelector(pattern.selectors.company);
  const location = querySelector(pattern.selectors.location);
  const description = querySelector(pattern.selectors.description);
  
  return {
    title: title?.textContent?.trim() || "",
    company: company?.textContent?.trim() || "",
    location: location?.textContent?.trim() || "",
    description: description?.textContent?.trim() || "",
    url: window.location.href,
    platform: pattern.name
  };
}
```

**Workday-specific selectors used:**
```typescript
{
  name: "Workday",
  domains: ["myworkdayjobs.com"],
  selectors: {
    title: '[data-automation-id="jobPostingHeader"]',
    company: '[data-automation-id="company"]',
    location: '[data-automation-id="locations"]',
    description: '[data-automation-id="jobPostingDescription"]',
    applyButton: '[data-automation-id="apply"]'
  }
}
```

**What happens:**
- Matches current URL against job board patterns
- Uses data-automation-id selectors for Workday
- Extracts job title, company, location, description
- Returns structured JobInfo object

---

### **Step 4: Form Detection**
**File:** `src/lib/dom/formDetector.ts` (Lines 80-120)

```typescript
export const detectForms = (): DetectedForm[] => {
  const forms = document.querySelectorAll('form');
  
  return Array.from(forms)
    .map(form => {
      const fields = extractFields(form);
      const score = scoreForm(form, fields);
      
      return {
        element: form,
        fields: fields,
        score: score,
        metadata: {
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method,
          fieldCount: fields.length
        }
      };
    })
    .filter(form => form.score > 50)
    .sort((a, b) => b.score - a.score);
}
```

**Scoring algorithm:**
```typescript
const scoreForm = (form: HTMLFormElement, fields: DetectedFormField[]): number => {
  let score = 0;
  
  // High-value keywords
  const HIGH_VALUE_KEYWORDS = [
    "application", "apply", "job", "resume", "cv",
    "career", "employment", "candidate"
  ];
  
  // Check form attributes
  const formText = (form.id + form.name + form.className).toLowerCase();
  HIGH_VALUE_KEYWORDS.forEach(keyword => {
    if (formText.includes(keyword)) score += 20;
  });
  
  // Field-based scoring
  score += fields.length * 2;
  
  // Bonus for specific field types
  const hasEmail = fields.some(f => f.type === "email");
  const hasResume = fields.some(f => f.type === "file");
  if (hasEmail) score += 15;
  if (hasResume) score += 25;
  
  return score;
}
```

**What happens:**
- Finds all forms on the page
- Extracts fields from each form
- Scores forms based on relevance to job applications
- Returns only high-scoring forms (>50 points)

---

### **Step 5: Background Notification**
**File:** `src/background/index.ts` (Lines 30-45)

Content script sends message:
```typescript
// From content script
chrome.runtime.sendMessage({
  type: MessageType.JOB_PAGE_DETECTED,
  data: { jobInfo, forms: detectedForms }
});
```

Background receives and updates UI:
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageType.JOB_PAGE_DETECTED) {
    const tabId = sender.tab?.id;
    
    // Update badge to show detection
    if (tabId) {
      chrome.action.setBadgeText({ text: "✓", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981", tabId });
    }
    
    // Store job board tab
    jobBoardTabs.set(tabId, {
      jobInfo: message.data.jobInfo,
      formCount: message.data.forms.length,
      timestamp: Date.now()
    });
  }
  
  sendResponse({ success: true });
});
```

**What happens:**
- Badge icon changes to green checkmark
- Tab ID stored in background's active job boards map
- Extension popup knows to show "Analyze Job" button

---

### **Step 6: User Opens Popup**
**File:** `src/popup/index.tsx` (Lines 20-50)

```typescript
const FlashPopup = () => {
  const [currentJob, setCurrentJob] = useState<JobInfo | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  useEffect(() => {
    // Load current job from storage
    storage.get("currentJob").then(setCurrentJob);
  }, []);
  
  const handleAnalyze = async () => {
    if (!currentJob) return;
    
    setIsAnalyzing(true);
    
    try {
      const response = await sendToBackground({
        name: "analyzeJob",
        body: {
          jobUrl: currentJob.url,
          jobDescription: currentJob.description
        }
      });
      
      if (response.success) {
        // Show success message
        // Open sidepanel for full workflow
        chrome.sidePanel.open();
      }
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  return (
    <div className="w-80 p-4">
      {currentJob ? (
        <>
          <h2>{currentJob.title}</h2>
          <p>{currentJob.company}</p>
          <Button onClick={handleAnalyze} loading={isAnalyzing}>
            Analyze Job
          </Button>
        </>
      ) : (
        <p>Navigate to a job posting to get started</p>
      )}
    </div>
  );
}
```

**What happens:**
- Popup reads current job from storage
- Displays job title and company
- Shows "Analyze Job" button
- On click, sends message to background handler

---

### **Step 7: Background Message Handler**
**File:** `src/background/messages/analyzeJob.ts` (Lines 10-40)

```typescript
import type { PlasmoMessaging } from "@plasmohq/messaging"
import { flashAPI } from "~lib/api/flash"
import { storage } from "~lib/storage/chrome"
import type { AnalyzeJobRequest, JobAnalysis } from "~types/flash"

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  try {
    const { jobUrl, jobDescription } = req.body as {
      jobUrl: string
      jobDescription: string
    }
    
    // Validate input
    if (!jobUrl || !jobDescription) {
      return res.send({
        success: false,
        error: "Missing required fields"
      })
    }
    
    // Get user profile from storage
    const userProfile = await storage.get("userProfile")
    if (!userProfile) {
      return res.send({
        success: false,
        error: "User profile not configured"
      })
    }
    
    // Call Flash API
    const analysis = await flashAPI.analyzeJob({
      job_url: jobUrl,
      job_description: jobDescription,
      user_profile: userProfile
    })
    
    // Store analysis results
    await storage.set("lastAnalysis", analysis)
    
    res.send({
      success: true,
      data: analysis
    })
  } catch (error) {
    res.send({
      success: false,
      error: error.message
    })
  }
}

export default handler
```

**What happens:**
- Validates request body
- Retrieves user profile from storage
- Calls Flash API service method
- Stores analysis results
- Returns success/error response

---

### **Step 8: API Service Layer**
**File:** `src/lib/api/flash.ts` (Lines 20-35)

```typescript
import { client } from "./client"
import type {
  AnalyzeJobRequest,
  JobAnalysis,
  TailorResumeRequest,
  TailoredResume
} from "~types/flash"

export const flashAPI = {
  analyzeJob: async (data: AnalyzeJobRequest): Promise<JobAnalysis> => {
    return client.request<JobAnalysis>({
      method: "POST",
      url: "/jobs/analyze",
      data
    })
  },
  
  tailorResume: async (data: TailorResumeRequest): Promise<TailoredResume> => {
    return client.request<TailoredResume>({
      method: "POST",
      url: "/resumes/tailor",
      data
    })
  },
  
  // ... other API methods
}
```

**What happens:**
- Wraps client.request() with type safety
- Maps to backend API endpoints
- Returns strongly-typed responses

---

### **Step 9: HTTP Client Layer**
**File:** `src/lib/api/client.ts` (Lines 40-100)

```typescript
class FlashAPIClient {
  private axiosInstance: AxiosInstance
  private baseURL: string = ""
  private apiKey: string = ""
  
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.request<APIResponse<T>>(config)
      
      // Handle API response format
      if (response.data.success) {
        return response.data.data
      } else {
        throw new FlashAPIError(
          response.data.error || "API request failed",
          response.status,
          response.data.code
        )
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with error
          throw new FlashAPIError(
            error.response.data.error || error.message,
            error.response.status,
            error.response.data.code
          )
        } else if (error.request) {
          // Network error
          throw new FlashNetworkError(
            "Network error - please check your connection"
          )
        }
      }
      throw error
    }
  }
}

// Axios interceptors for auth and retries
client.axiosInstance.interceptors.request.use(config => {
  if (client.apiKey) {
    config.headers.Authorization = `Bearer ${client.apiKey}`
  }
  return config
})

// Retry logic for failed requests
axiosRetry(client.axiosInstance, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === 429
  }
})
```

**What happens:**
- Makes POST request to `/jobs/analyze` endpoint
- Adds Bearer token authentication
- Handles response/error formatting
- Implements retry logic for failures
- Returns typed JobAnalysis object

---

### **Step 10: Storage & Results**
**File:** `src/lib/storage/chrome.ts` (Lines 20-40)

```typescript
class FlashStorage {
  async set<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  }
  
  async get<K extends keyof StorageData>(
    key: K
  ): Promise<StorageData[K] | null> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as StorageData[K] | null) || null
  }
}

export const storage = new FlashStorage()
```

**Stored analysis structure:**
```typescript
interface JobAnalysis {
  job_id: string
  match_score: number
  match_reasons: string[]
  key_requirements: Requirement[]
  missing_skills: string[]
  recommended_highlights: string[]
  estimated_competition: "low" | "medium" | "high"
  application_strategy: string
  tailoring_suggestions: TailoringSuggestion[]
}
```

**What happens:**
- Stores complete analysis in chrome.storage.local
- Makes results accessible to all extension components
- Persists across browser sessions

---

### **Step 11: Sidepanel Display**
**File:** `src/sidepanel/index.tsx` (Lines 50-100)

```typescript
const FlashSidepanel = () => {
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null)
  const [currentJob, setCurrentJob] = useState<JobInfo | null>(null)
  
  useEffect(() => {
    // Load analysis and job info
    Promise.all([
      storage.get("lastAnalysis"),
      storage.get("currentJob")
    ]).then(([analysisData, jobData]) => {
      setAnalysis(analysisData)
      setCurrentJob(jobData)
    })
  }, [])
  
  const handleTailorResume = async () => {
    const response = await sendToBackground({
      name: "tailorResume",
      body: {
        jobId: analysis.job_id,
        targetRole: currentJob.title
      }
    })
    // ... handle tailored resume
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Analysis Results */}
      <Card>
        <h2>Match Score</h2>
        <ConfidenceScore score={analysis.match_score} />
        
        <h3>Key Requirements</h3>
        {analysis.key_requirements.map(req => (
          <div key={req.id}>
            <span>{req.text}</span>
            <span>Match: {req.match_level}</span>
          </div>
        ))}
        
        <h3>Missing Skills</h3>
        {analysis.missing_skills.map(skill => (
          <span key={skill}>{skill}</span>
        ))}
      </Card>
      
      {/* Actions */}
      <Button onClick={handleTailorResume}>
        Tailor Resume
      </Button>
    </div>
  )
}
```

**What happens:**
- Loads stored analysis results
- Displays match score with confidence indicator
- Shows key requirements and gaps
- Provides next action buttons (tailor resume, etc.)

---

## 📊 Complete File Interaction Flow

```
User navigates to Workday job page
    ↓
[src/content/index.tsx]
  ├─ PlasmoCSConfig matches URL pattern
  ├─ Component mounts
  └─ performInitialScan() executes
    ↓
[src/lib/dom/jobExtractor.ts]
  ├─ extractJobInfo() called
  ├─ Matches myworkdayjobs.com domain
  ├─ Uses data-automation-id selectors
  └─ Returns JobInfo object
    ↓
[src/lib/dom/formDetector.ts]
  ├─ detectForms() called
  ├─ Finds all <form> elements
  ├─ Scores each form for relevance
  └─ Returns DetectedForm[] array
    ↓
[src/lib/storage/chrome.ts]
  ├─ storage.set("currentJob", jobInfo)
  └─ storage.set("detectedForms", forms)
    ↓
[src/background/index.ts]
  ├─ Receives JOB_PAGE_DETECTED message
  ├─ Updates badge icon to green checkmark
  └─ Stores tab in active job boards map
    ↓
User clicks extension icon
    ↓
[src/popup/index.tsx]
  ├─ Reads currentJob from storage
  ├─ Displays job title and company
  └─ Shows "Analyze Job" button
    ↓
User clicks "Analyze Job"
    ↓
[src/background/messages/analyzeJob.ts]
  ├─ Receives analyzeJob message
  ├─ Validates request body
  ├─ Retrieves user profile from storage
  └─ Calls flashAPI.analyzeJob()
    ↓
[src/lib/api/flash.ts]
  ├─ analyzeJob() method called
  └─ Calls client.request() with typed params
    ↓
[src/lib/api/client.ts]
  ├─ Adds Bearer token authentication
  ├─ Makes POST to /jobs/analyze endpoint
  ├─ Handles response/error formatting
  ├─ Implements retry logic
  └─ Returns JobAnalysis object
    ↓
Backend API (Atlas Flash Service)
  ├─ Processes job description
  ├─ Compares with user profile
  ├─ Calculates match score
  └─ Returns analysis with recommendations
    ↓
[src/background/messages/analyzeJob.ts]
  └─ Stores analysis via storage.set()
    ↓
[src/lib/storage/chrome.ts]
  └─ chrome.storage.local.set({ lastAnalysis })
    ↓
[src/popup/index.tsx]
  └─ Opens sidepanel: chrome.sidePanel.open()
    ↓
[src/sidepanel/index.tsx]
  ├─ Loads analysis from storage
  ├─ Displays match score
  ├─ Shows key requirements
  ├─ Lists missing skills
  └─ Provides action buttons
```

---

## 🔑 Key Files By Responsibility

### **Content Injection & Detection**
- `src/content/index.tsx` - Main content script coordinator
- `src/lib/dom/jobExtractor.ts` - Job information extraction
- `src/lib/dom/formDetector.ts` - Application form detection

### **Background Processing**
- `src/background/index.ts` - Service worker coordinator
- `src/background/messages/analyzeJob.ts` - Job analysis handler
- `src/background/messages/tailorResume.ts` - Resume tailoring handler
- `src/background/messages/answerQuestion.ts` - Question answering handler
- `src/background/messages/fillApplication.ts` - Form filling handler

### **API Communication**
- `src/lib/api/client.ts` - HTTP client with auth & retries
- `src/lib/api/flash.ts` - Flash service API methods

### **Data Persistence**
- `src/lib/storage/chrome.ts` - Chrome storage wrapper

### **User Interface**
- `src/popup/index.tsx` - Quick action popup
- `src/sidepanel/index.tsx` - Full workflow interface
- `src/components/*.tsx` - Reusable UI components

### **Type Definitions**
- `src/types/flash.ts` - Backend API types
- `src/types/form.ts` - DOM interaction types
- `src/types/chrome.ts` - Extension messaging types

---

## 🚀 Next Steps in Workflow

After job analysis, the typical user flow continues:

1. **Tailor Resume** → `background/messages/tailorResume.ts` → API → Store tailored version
2. **Review Questions** → User sees common application questions
3. **Generate Answers** → `background/messages/answerQuestion.ts` → API → Store answers
4. **Fill Application** → `background/messages/fillApplication.ts` → `lib/dom/fieldInjector.ts` → Inject answers
5. **Review & Submit** → User verifies and submits application

Each step follows the same pattern: UI → Background Handler → API Service → Client → Backend → Storage → UI Update
