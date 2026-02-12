/**
 * Flash Content Script
 * Runs on job board pages to detect jobs, forms, and facilitate auto-fill
 */
import type { PlasmoCSConfig } from "plasmo"
import { sendToBackground } from "@plasmohq/messaging"
import { FormDetector } from "~lib/dom/formDetector"
import { JobExtractor } from "~lib/dom/jobExtractor"
import { FieldInjector } from "~lib/dom/fieldInjector"
import { debounce } from "~lib/utils/helpers"
import { flashSyncStorage, flashStorage } from "~lib/storage/chrome"
import type {
  Answer,
  ExtractedJobInfo,
  FormField,
  FormMetadata,
  JobDescription
} from "~types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.linkedin.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://*.myworkday.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.indeed.com/*",
    "https://*.glassdoor.com/*"
  ],
  run_at: "document_idle"
}

const jobExtractor = new JobExtractor()
const formDetector = new FormDetector()
const fieldInjector = new FieldInjector()

let latestJobInfo: ExtractedJobInfo | null = null
let latestForms: FormMetadata | null = null
let statusIndicator: HTMLDivElement | null = null
let autoFillEnabled = false
let isProcessingForm = false
let processedFormIds = new Set<string>()
let lastFormDetectionTime = 0

function ensureStatusIndicator() {
  if (statusIndicator && document.body?.contains(statusIndicator)) return

  const indicator = document.createElement("div")
  indicator.id = "flash-status-indicator"
  Object.assign(indicator.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: "rgba(17, 24, 39, 0.9)",
    color: "white",
    padding: "8px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    zIndex: "999999",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    transition: "opacity 0.2s ease",
    opacity: "0"
  })
  indicator.textContent = "Flash: idle"
  document.body?.appendChild(indicator)
  statusIndicator = indicator
}

function updateStatus(message: string, show = true) {
  ensureStatusIndicator()
  if (!statusIndicator) return

  statusIndicator.textContent = `⚡ Flash: ${message}`
  statusIndicator.style.opacity = show ? "1" : "0"
  
  // Auto-hide after 3 seconds unless it's an important status
  if (show && !message.includes('filling') && !message.includes('processing')) {
    setTimeout(() => {
      if (statusIndicator) statusIndicator.style.opacity = "0"
    }, 3000)
  }
}
var extract = false;
function extractJobInfo(): ExtractedJobInfo | null {
  try {
    updateStatus("scanning job", true)
    
    const jobInfo = jobExtractor.extractJobInfo()
    if (jobInfo?.title || jobInfo?.description) {
      latestJobInfo = jobInfo
      updateStatus("job detected", true)
      
      // Debug output
      if(extract==false){
console.log("[Flash Debug] Extracted Job Info:", {
        title: jobInfo.title,
        company: jobInfo.company,
        location: jobInfo.location,
        url: jobInfo.url,
        descriptionLength: jobInfo.description?.length || 0,
        requirementsCount: jobInfo.requirements?.length || 0
      })
      }
      
      extract = true;
      
      return jobInfo
    }
  } catch (error) {
    console.error("[Flash Content] Error extracting job info:", error)
  }

  return null
}

function detectForms(): FormMetadata | null {
  try {
    updateStatus("scanning forms", true)
    const formData = formDetector.detectForms()
    latestForms = formData
    if (formData?.forms?.length) {
      updateStatus(`forms detected (${formData.forms.length})`, true)
      
      // Debug output
      console.log("[Flash Debug] Detected Forms:", {
        formCount: formData.forms.length,
        forms: formData.forms.map(form => ({
          score: form.score,
          fieldCount: form.fields.length,
          fields: form.fields.map(f => ({ label: f.label, type: f.type, required: f.required }))
        }))
      })
      
      // Trigger auto-fill if enabled and this is a new form
      if (autoFillEnabled && !isProcessingForm) {
        const formId = generateFormId(formData.forms[0])
        if (!processedFormIds.has(formId)) {
          console.log("[Flash AutoFill] New form detected, triggering auto-fill")
          triggerAutoFill(formId)
        }
      }
    }
    return formData
  } catch (error) {
    console.error("[Flash Content] Error detecting forms:", error)
  }
  return null
}

async function analyzeJob() {
  console.log("analyzing job called by sidepanel")
  const jobInfo = latestJobInfo ?? extractJobInfo()
  if (!jobInfo?.description || !jobInfo?.title) {
    return { success: false, error: "Job information not found on this page" }
  }

  updateStatus("analyzing job now", true)
  
  // Get user profile
  const userProfile = await flashSyncStorage.get("userProfile")
  
  const jobDescription: JobDescription = {
    title: jobInfo.title || "",
    company: jobInfo.company || "",
    description: jobInfo.description || "",
    requirements: jobInfo.requirements || [],
    url: jobInfo.url,
    location: jobInfo.location
  }
  
  try {
    const response = await sendToBackground({
      name: "analyzeJob",
      body: { 
        jobDescription,
        userId: userProfile?.id 
      }
    })
    
    updateStatus("analysis complete", true)
    console.log("analysis complete in content", response.success)
    return response
  } catch (error) {
    console.error("[Flash Content] Error analyzing job:", error)
    updateStatus("analysis failed", true)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to analyze job. Check if backend is running." 
    }
  }
}

async function  fillApplication() {
  console.log("[Flash Content] fillApplication called")
  
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) {
    return { success: false, error: "No application form detected" }
  }

  const userProfile = await flashSyncStorage.get("userProfile")
  
 if (!userProfile?.id) {
    return { success: false, error: "User profile not found. Please set up your profile in settings." }
  }
  // Get current session to retrieve job_id from analysis
  const currentSession = await flashStorage.get("currentSession")
  const jobId = currentSession?.currentJob?.job_id

 

 
  
  console.log("[Flash Content] Session jobId:", jobId)

  const primaryForm = forms.forms[0]
  console.log(`[Flash Content] Processing form with ${primaryForm.fields.length} fields`)
  
  const normalizeFieldType = (type: string): FormField["type"] => {
    const allowed: FormField["type"][] = [
      "text",
      "email",
      "phone",
      "textarea",
      "select",
      "radio",
      "checkbox",
      "file",
      "date"
    ]

    return allowed.includes(type as FormField["type"]) ? (type as FormField["type"]) : "text"
  }

  const formFields: FormField[] = primaryForm.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: normalizeFieldType(field.type),
    required: field.required,
    placeholder: field.placeholder,
    options: field.options?.map((opt) => opt.label) || [],
    value: field.value
  }))

  updateStatus("generating answers", true)
  
  try {
    const response = await sendToBackground({
      name: "fillApplication",
      body: {
        formFields,
        userId: userProfile.id,
        jobId: jobId
      }
    })
    
    updateStatus("answers generated", true)
    console.log("[Flash Content] Received answers:", response.success ? response.data.answers.length : "failed")
    return response
  } catch (error) {
    console.error("[Flash Content] Error filling application:", error)
    updateStatus("generation failed", true)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate answers. Check if backend is running."
    }
  }
}

async function injectAnswers(answers: Answer[]) {
  console.log("[Flash Content] injectAnswers called with", answers.length, "answers")
  
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) {
    return { success: false, error: "No form fields available for injection" }
  }

  updateStatus("injecting answers", true)
  const primaryForm = forms.forms[0]
  const answersMap = new Map<string, string>()
  
  // Map answers by field_id
  answers.forEach((answer) => {
    if (answer.field_id) {
      answersMap.set(answer.field_id, answer.answer)
      console.log("[Flash Content] Mapping answer for field:", answer.field_id)
    }
  })
  
  console.log(`[Flash Content] Injecting ${answersMap.size} answers into ${primaryForm.fields.length} fields`)

  try {
    const result = await fieldInjector.injectAnswers(primaryForm.fields, answersMap)
    updateStatus(`injected ${result.filled}/${result.total}`, true)
    console.log("[Flash Content] Injection complete:", result)
    return { success: true, data: result }
  } catch (error) {
    console.error("[Flash Content] Injection error:", error)
    updateStatus("injection failed", true)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to inject answers"
    }
  }
}

function setupMutationObserver() {
  const scan = debounce(() => {
    extractJobInfo()
    detectForms()
  }, 1000)

  const observer = new MutationObserver(() => {
    const now = Date.now()
    // Throttle to avoid too frequent scans
    if (now - lastFormDetectionTime > 2000) {
      lastFormDetectionTime = now
      scan()
    }
  })

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
}

/**
 * Generate unique ID for a form based on its structure
 */
function generateFormId(form: any): string {
  const fieldSignature = form.fields
    .map((f: any) => `${f.label}-${f.type}`)
    .sort()
    .join('|')
  return `${window.location.pathname}-${fieldSignature}`.substring(0, 100)
}

/**
 * Trigger automatic form filling
 */
async function triggerAutoFill(formId: string) {
  if (isProcessingForm) {
    console.log("[Flash AutoFill] Already processing, skipping")
    return
  }

  try {
    isProcessingForm = true
    processedFormIds.add(formId)
    
    console.log("[Flash AutoFill] Starting auto-fill for form:", formId)
    updateStatus("🤖 auto-filling form...", true)

    // Step 1: Fill application
    const fillResponse = await fillApplication()
    
    if (!fillResponse.success) {
      console.error("[Flash AutoFill] Failed to generate answers:", fillResponse.error)
      updateStatus(`❌ auto-fill failed: ${fillResponse.error}`, true)
      isProcessingForm = false
      return
    }

    const answers = fillResponse.data?.answers || []
    console.log(`[Flash AutoFill] Generated ${answers.length} answers`)

    // Step 2: Inject answers
    if (answers.length > 0) {
      const injectResponse = await injectAnswers(answers)
      
      if (injectResponse.success && injectResponse.data) {
        const result = injectResponse.data
        console.log(`[Flash AutoFill] Injection complete: ${result.filled}/${result.total} fields`)
        updateStatus(`✅ filled ${result.filled} fields`, true)
        
        // Show notification
        showNotification(
          "Form Auto-Filled",
          `Filled ${result.filled} fields. Please review before submitting.`,
          "success"
        )
      } else {
        console.error("[Flash AutoFill] Injection failed:", injectResponse.error)
        updateStatus("❌ injection failed", true)
      }
    }

    // Small delay before allowing next form
    await new Promise(resolve => setTimeout(resolve, 2000))
    
  } catch (error) {
    console.error("[Flash AutoFill] Error:", error)
    updateStatus("❌ auto-fill error", true)
  } finally {
    isProcessingForm = false
  }
}

/**
 * Show notification overlay
 */
function showNotification(title: string, message: string, type: 'success' | 'error' | 'info' = 'info') {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    max-width: 320px;
    animation: slideIn 0.3s ease;
  `
  
  notification.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 12px; opacity: 0.9;">${message}</div>
  `
  
  document.body?.appendChild(notification)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => notification.remove(), 300)
  }, 5000)
}

/**
 * Initialize preferences and auto-fill settings
 */
async function initializeAutoFill() {
  try {
    const prefs = await flashSyncStorage.get('preferences')
    autoFillEnabled = prefs?.autoFill ?? false
    
    console.log('[Flash Content] Auto-fill enabled:', autoFillEnabled)
    
    if (autoFillEnabled) {
      updateStatus('🤖 auto-fill active', true)
    }
  } catch (error) {
    console.error('[Flash Content] Error loading preferences:', error)
  }
}

function initialScan() {
  updateStatus("starting scan", true)
  initializeAutoFill()
  extractJobInfo()
  detectForms()
  setupMutationObserver()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialScan)
} else {
  initialScan()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ;(async () => {
    switch (message.type) {
      case "PING":
        sendResponse({ success: true })
        break

      case "GET_JOB_INFO":
        sendResponse({ success: true, data: latestJobInfo })
        break

      case "GET_FORMS":
        sendResponse({ success: true, data: latestForms })
        break

      case "EXTRACT_JOB":
        sendResponse({ success: true, data: extractJobInfo() })
        break

      case "DETECT_FORMS":
        sendResponse({ success: true, data: detectForms() })
        break

      case "ANALYZE_JOB":
        sendResponse(await analyzeJob())
        break

      case "FILL_APPLICATION":
        sendResponse(await fillApplication())
        break

      case "INJECT_ANSWERS":
        sendResponse(await injectAnswers(message.payload?.answers || []))
        break
      
      case "TOGGLE_AUTO_FILL":
        autoFillEnabled = !autoFillEnabled
        console.log("[Flash Content] Auto-fill toggled:", autoFillEnabled)
        updateStatus(autoFillEnabled ? "🤖 auto-fill enabled" : "⏸️ auto-fill disabled", true)
        
        // Update preferences
        const currentPrefs = await flashSyncStorage.get('preferences')
        if (currentPrefs) {
          await flashSyncStorage.set('preferences', {
            ...currentPrefs,
            autoFill: autoFillEnabled
          })
        } else {
          await flashSyncStorage.set('preferences', {
            autoFill: autoFillEnabled,
            autoAnalyze: false,
            autoOpenSidepanel: false,
            minConfidence: 0.5,
            highlightFilled: true,
            enableNotifications: true,
            theme: 'auto'
          })
        }
        
        sendResponse({ success: true, autoFillEnabled })
        break
      
      case "ENABLE_AUTO_FILL":
        autoFillEnabled = true
        console.log("[Flash Content] Auto-fill enabled")
        updateStatus("🤖 auto-fill enabled", true)
        sendResponse({ success: true })
        break
      
      case "DISABLE_AUTO_FILL":
        autoFillEnabled = false
        isProcessingForm = false
        console.log("[Flash Content] Auto-fill disabled")
        updateStatus("⏸️ auto-fill disabled", true)
        sendResponse({ success: true })
        break
      
      case "RESET_PROCESSED_FORMS":
        processedFormIds.clear()
        console.log("[Flash Content] Cleared processed forms cache")
        sendResponse({ success: true })
        break

      default:
        sendResponse({ success: false, error: "Unknown message type" })
        break
    }
  })()

  return true
})