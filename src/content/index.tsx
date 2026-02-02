// Content Script - Main entry point
// Runs on job board pages to detect forms and inject answers

import type { PlasmoCSConfig } from 'plasmo';
import { formDetector, jobExtractor, fieldInjector } from '~lib/dom';
import { sendMessage } from '~lib/utils/helpers';
import type { Message, FormMetadata, ExtractedJobInfo } from '~types';

// Configure content script injection
export const config: PlasmoCSConfig = {
  matches: [
    'https://www.linkedin.com/jobs/*',
    'https://*.greenhouse.io/*',
    'https://*.lever.co/*',
    'https://*.workday.com/*',
    'https://*.myworkdayjobs.com/*',
    'https://www.indeed.com/viewjob*',
    'https://www.glassdoor.com/job-listing/*',
  ],
  run_at: 'document_idle',
};

console.log('[Flash Content] Content script loaded on', window.location.href);

// State
let detectedForms: FormMetadata | null = null;
let detectedJob: ExtractedJobInfo | null = null;
let observerActive = false;

// Initialize
init();

function init() {
  console.log('[Flash Content] Initializing...');
  
  // Initial scan
  performInitialScan();
  
  // Set up mutation observer to detect dynamically loaded forms
  setupMutationObserver();
  
  // Listen for messages from background/popup
  setupMessageListener();
  
  // Add visual indicator
  addFlashIndicator();
}

/**
 * Perform initial scan of the page
 */
function performInitialScan() {
  console.log('[Flash Content] Performing initial scan...');
  
  // Check if this is a job page
  if (jobExtractor.isJobPage()) {
    console.log('[Flash Content] Job page detected');
    detectedJob = jobExtractor.extractJobInfo();
    
    // Notify background
    notifyJobDetected(detectedJob);
  }
  
  // Detect forms
  const forms = formDetector.detectForms();
  if (forms && forms.forms.length > 0) {
    console.log(`[Flash Content] Detected ${forms.forms.length} application form(s)`);
    detectedForms = forms;
    
    // Notify background
    notifyFormsDetected(forms);
  }
}

/**
 * Set up mutation observer for dynamic content
 */
function setupMutationObserver() {
  if (observerActive) return;
  
  const observer = new MutationObserver((mutations) => {
    // Check if any significant DOM changes occurred
    const hasSignificantChanges = mutations.some(
      (mutation) => 
        mutation.type === 'childList' && 
        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
    );
    
    if (hasSignificantChanges) {
      // Debounce the scan
      debouncedScan();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  observerActive = true;
  console.log('[Flash Content] Mutation observer active');
}

// Debounced scan function
let scanTimeout: NodeJS.Timeout;
function debouncedScan() {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    // Only scan for forms if we haven't detected them yet
    if (!detectedForms) {
      const forms = formDetector.detectForms();
      if (forms && forms.forms.length > 0) {
        console.log('[Flash Content] Forms detected after mutation');
        detectedForms = forms;
        notifyFormsDetected(forms);
      }
    }
  }, 1000);
}

/**
 * Set up message listener
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    console.log('[Flash Content] Received message:', message.type);
    
    handleMessage(message)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        console.error('[Flash Content] Error handling message:', error);
        sendResponse({
          success: false,
          error: error.message,
        });
      });
    
    // Return true for async response
    return true;
  });
}

/**
 * Handle messages from background/popup
 */
async function handleMessage(message: Message) {
  switch (message.type) {
    case 'PING':
      return { success: true, data: 'pong' };
    
    case 'GET_FORMS':
      return { success: true, data: detectedForms };
    
    case 'GET_JOB_INFO':
      return { success: true, data: detectedJob };
    
    case 'DETECT_FORMS':
      detectedForms = formDetector.detectForms();
      return { success: true, data: detectedForms };
    
    case 'EXTRACT_JOB':
      detectedJob = jobExtractor.extractJobInfo();
      return { success: true, data: detectedJob };
    
    case 'INJECT_ANSWERS':
      return await handleInjectAnswers(message.payload);
    
    case 'INJECT_FIELD':
      return await handleInjectField(message.payload);
    
    case 'CLEAR_HIGHLIGHTS':
      fieldInjector.clearHighlights();
      return { success: true };
    
    case 'ANALYZE_JOB':
      return await handleAnalyzeJob();
    
    case 'FILL_APPLICATION':
      return await handleFillApplication();
    
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Handle injecting multiple answers
 */
async function handleInjectAnswers(payload: any) {
  const { answers } = payload;
  
  if (!detectedForms || detectedForms.forms.length === 0) {
    return { success: false, error: 'No forms detected' };
  }
  
  const form = detectedForms.forms[0]; // Use first detected form
  const answerMap = new Map<string, string>(
    Object.entries(answers).map(([key, value]) => [key, String(value)])
  );
  
  const result = await fieldInjector.injectAnswers(form.fields, answerMap);
  
  return {
    success: true,
    data: result,
  };
}

/**
 * Handle injecting single field
 */
async function handleInjectField(payload: any) {
  const { fieldId, value } = payload;
  
  if (!detectedForms || detectedForms.forms.length === 0) {
    return { success: false, error: 'No forms detected' };
  }
  
  const form = detectedForms.forms[0];
  const field = form.fields.find((f) => f.id === fieldId || f.name === fieldId);
  
  if (!field) {
    return { success: false, error: `Field not found: ${fieldId}` };
  }
  
  try {
    await fieldInjector.injectField(field, value);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Injection failed',
    };
  }
}

/**
 * Handle analyze job request
 */
async function handleAnalyzeJob() {
  if (!detectedJob) {
    detectedJob = jobExtractor.extractJobInfo();
  }
  
  if (!detectedJob || !detectedJob.title) {
    return { success: false, error: 'No job information found on this page' };
  }
  
  // Send to background for API call
  const response = await sendMessage({
    type: 'ANALYZE_JOB',
    payload: {
      jobDescription: {
        title: detectedJob.title,
        company: detectedJob.company || 'Unknown',
        description: detectedJob.description || '',
        requirements: detectedJob.requirements || [],
        url: window.location.href,
        location: detectedJob.location,
        salary_range: detectedJob.salary,
        job_type: detectedJob.jobType,
      },
    },
  });
  
  return response;
}

/**
 * Handle fill application request
 */
async function handleFillApplication() {
  if (!detectedForms || detectedForms.forms.length === 0) {
    return { success: false, error: 'No application forms found on this page' };
  }
  
  const form = detectedForms.forms[0];
  
  // Convert detected fields to FormField type
  const formFields = form.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type as any,
    required: field.required,
    placeholder: field.placeholder,
    options: field.options?.map((opt) => opt.value),
    value: field.value,
  }));
  
  // Send to background for API call
  const response = await sendMessage({
    type: 'FILL_APPLICATION',
    payload: {
      formFields,
      userId: 'user-123', // TODO: Get from storage
    },
  });
  
  return response;
}

/**
 * Notify background of detected job
 */
function notifyJobDetected(jobInfo: ExtractedJobInfo) {
  sendMessage({
    type: 'JOB_DETECTED',
    payload: jobInfo,
  }).catch((error) => {
    console.error('[Flash Content] Failed to notify job detection:', error);
  });
}

/**
 * Notify background of detected forms
 */
function notifyFormsDetected(forms: FormMetadata) {
  sendMessage({
    type: 'FORM_DETECTED',
    payload: forms,
  }).catch((error) => {
    console.error('[Flash Content] Failed to notify form detection:', error);
  });
}

/**
 * Add visual indicator that Flash is active
 */
function addFlashIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'flash-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      <span style="font-size: 18px;">⚡</span>
      <span>Flash Active</span>
    </div>
  `;
  
  // Click to open side panel
  indicator.addEventListener('click', () => {
    sendMessage({ type: 'OPEN_SIDEPANEL' });
  });
  
  document.body.appendChild(indicator);
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.5s ease';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 500);
  }, 5000);
}

// Export for Plasmo
export {};
