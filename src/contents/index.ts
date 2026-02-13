/**
 * Flash Content Script
 * Runs on job board pages to detect jobs, forms, and facilitate auto-fill
 */
import type { PlasmoCSConfig } from "plasmo"
import { sendToBackground } from "@plasmohq/messaging"
import { FormDetector } from "~lib/dom/formDetector"
import { JobExtractor } from "~lib/dom/jobExtractor"
import { FieldInjector } from "~lib/dom/fieldInjector"
import { debounce, sleep } from "~lib/utils/helpers"
import { flashSyncStorage, flashStorage, getUserProfile, getCurrentAuthUser } from "~lib/storage/chrome"
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
const MAX_VALIDATION_RETRY_ROUNDS = 2
const AUTO_ADVANCE_ALLOWED_LABELS = [
  "next",
  "continue",
  "save and continue",
  "next step",
  "sign in",
  "log in",
  "login"
]
const AUTO_ADVANCE_BLOCKED_LABELS = [
  "submit",
  "apply",
  "send application",
  "finish",
  "complete application"
]

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
  
  // Get authenticated user and their profile
  const currentUser = await getCurrentAuthUser();
  const userProfile = currentUser ? await getUserProfile(currentUser.id) : null;
  
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

function getPrimaryForm() {
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) return null
  return forms.forms[0]
}

function normalizeFieldType(type: string): FormField["type"] {
  if (type === "password") return "text"

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

function toFormFields(primaryForm: any, fieldIdFilter?: Set<string>): FormField[] {
  const scopedFields = fieldIdFilter
    ? primaryForm.fields.filter((field: any) => fieldIdFilter.has(field.id) || fieldIdFilter.has(field.name))
    : primaryForm.fields

  return scopedFields.map((field: any) => ({
    id: field.id,
    name: field.name,
    label: field.label,
    type: normalizeFieldType(field.type),
    required: field.required,
    placeholder: field.placeholder,
    options: field.options?.map((opt: any) => opt.label) || [],
    value: field.value,
    validation_rules: field.validation || null
  }))
}

async function fillApplication(fieldIdFilter?: Set<string>) {
  console.log("[Flash Content] fillApplication called")

  const primaryForm = getPrimaryForm()
  if (!primaryForm) {
    return { success: false, error: "No application form detected" }
  }

  const currentUser = await getCurrentAuthUser()
  const userProfile = currentUser ? await getUserProfile(currentUser.id) : null

  if (!userProfile?.user_id) {
    return { success: false, error: "User profile not found. Please set up your profile in settings." }
  }

  const currentSession = await flashStorage.get("currentSession")
  const jobId = currentSession?.currentJob?.job_id

  console.log("[Flash Content] Session jobId:", jobId)
  console.log(`[Flash Content] Processing form with ${primaryForm.fields.length} fields`)

  const formFields = toFormFields(primaryForm, fieldIdFilter)
  if (formFields.length === 0) {
    return { success: false, error: "No target fields available for answer generation" }
  }

  updateStatus("generating answers", true)
  console.log("Generating Answers to the fields")

  try {
    const response = await sendToBackground({
      name: "fillApplication",
      body: {
        formFields,
        userId: userProfile.user_id,
        jobId
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

function mapAnswersByFieldId(answers: Answer[]): Map<string, string> {
  const answersMap = new Map<string, string>()
  answers.forEach((answer) => {
    if (answer.field_id) {
      answersMap.set(answer.field_id, answer.answer)
    }
  })
  return answersMap
}

function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false
  }
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isFieldEmpty(field: any): boolean {
  const element = field.element as HTMLElement
  if (!element || !document.body.contains(element)) return false

  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return !element.checked
    return !element.value?.trim()
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.value?.trim()
  }
  if (element instanceof HTMLSelectElement) {
    return !element.value?.trim()
  }

  const textValue =
    element.getAttribute("aria-valuetext") ||
    element.getAttribute("aria-label") ||
    element.textContent ||
    ""
  return !textValue.trim()
}

function findMatchingFieldForElement(fields: any[], element: HTMLElement | null) {
  if (!element) return null
  const elementId = element.id
  const elementName = element.getAttribute("name") || ""

  return (
    fields.find((field: any) => field.element === element) ||
    fields.find((field: any) => field.element?.contains(element)) ||
    (elementId ? fields.find((field: any) => field.id === elementId || field.name === elementId) : null) ||
    (elementName ? fields.find((field: any) => field.name === elementName || field.id === elementName) : null) ||
    null
  )
}

function collectValidationDelta(primaryForm: any) {
  const deltaFieldIds = new Set<string>()
  const validationErrors: string[] = []
  const fields = primaryForm.fields || []

  fields.forEach((field: any) => {
    if (!field?.required) return
    if (!field?.element || !isElementVisible(field.element)) return
    if (isFieldEmpty(field)) {
      deltaFieldIds.add(field.id)
    }
  })

  const invalidControls = document.querySelectorAll(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"], [role="combobox"][aria-invalid="true"], [aria-haspopup="listbox"][aria-invalid="true"]'
  )
  invalidControls.forEach((control) => {
    const matched = findMatchingFieldForElement(fields, control as HTMLElement)
    if (matched?.id) deltaFieldIds.add(matched.id)
  })

  const errorElements = document.querySelectorAll(
    '[role="alert"], [aria-live="assertive"], .error, .errors, [data-automation-id*="error"], [id*="error"]'
  )
  errorElements.forEach((errorElement) => {
    const el = errorElement as HTMLElement
    if (!isElementVisible(el)) return
    const text = el.textContent?.trim() || ""
    if (text && text.length <= 180) {
      validationErrors.push(text)
    }

    const errorId = el.id
    let linkedControl: HTMLElement | null = null
    if (errorId) {
      linkedControl = document.querySelector(
        `[aria-describedby~="${errorId}"], [aria-errormessage="${errorId}"]`
      ) as HTMLElement | null
    }
    if (!linkedControl) {
      linkedControl =
        (el.closest("label")?.querySelector(
          'input, textarea, select, [role="combobox"], [aria-haspopup="listbox"]'
        ) as HTMLElement | null) ||
        (el.parentElement?.querySelector(
          'input, textarea, select, [role="combobox"], [aria-haspopup="listbox"]'
        ) as HTMLElement | null)
    }

    const matched = findMatchingFieldForElement(fields, linkedControl)
    if (matched?.id) deltaFieldIds.add(matched.id)
  })

  return {
    deltaFieldIds,
    validationErrors: Array.from(new Set(validationErrors))
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function getElementLabel(element: HTMLElement): string {
  if (element instanceof HTMLInputElement) {
    return normalizeText(element.value || element.getAttribute("aria-label") || "")
  }
  return normalizeText(
    element.textContent ||
      element.getAttribute("aria-label") ||
      element.getAttribute("value") ||
      ""
  )
}

function isButtonEnabled(button: HTMLElement): boolean {
  const disabledAttr = button.getAttribute("disabled") !== null
  const ariaDisabled = button.getAttribute("aria-disabled") === "true"
  const classDisabled = /\bdisabled\b/i.test(button.className || "")
  if (disabledAttr || ariaDisabled || classDisabled) return false
  return isElementVisible(button)
}

function isSafeAdvanceLabel(label: string): boolean {
  const lower = normalizeText(label)
  if (!lower) return false
  if (AUTO_ADVANCE_BLOCKED_LABELS.some((blocked) => lower.includes(blocked))) return false
  return AUTO_ADVANCE_ALLOWED_LABELS.some((allowed) => lower.includes(allowed))
}

function getStepSignature(): string {
  const heading =
    document.querySelector("h1, h2, [data-automation-id*='pageHeader'], [data-automation-id*='title']")?.textContent ||
    ""
  return `${window.location.pathname}|${normalizeText(heading)}`
}

function findAdvanceButton(primaryForm: any): HTMLElement | null {
  const scopedRoot = (primaryForm?.element as ParentNode) || document
  const candidates = scopedRoot.querySelectorAll(
    'button, input[type="button"], input[type="submit"], [role="button"]'
  )

  let bestMatch: HTMLElement | null = null
  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement)) continue
    if (!isButtonEnabled(candidate)) continue
    const label = getElementLabel(candidate)
    if (!isSafeAdvanceLabel(label)) continue
    bestMatch = candidate
    if (label.includes("save and continue")) return candidate
  }

  return bestMatch
}

async function autoAdvanceToNextStep(primaryForm: any) {
  const signatureBefore = getStepSignature()
  const button = findAdvanceButton(primaryForm)
  if (!button) {
    return { clicked: false, moved: false, reason: "No eligible next/continue button found" }
  }

  const buttonLabel = getElementLabel(button)
  if (AUTO_ADVANCE_BLOCKED_LABELS.some((blocked) => buttonLabel.includes(blocked))) {
    return { clicked: false, moved: false, reason: `Blocked button label: ${buttonLabel}` }
  }

  try {
    button.scrollIntoView({ block: "center", behavior: "smooth" })
    await sleep(150)
    button.click()
    console.log("[Flash Content] Auto-advance clicked:", buttonLabel)

    for (let i = 0; i < 8; i++) {
      await sleep(250)
      const now = getStepSignature()
      if (now !== signatureBefore) {
        return { clicked: true, moved: true, reason: "Step changed", buttonLabel }
      }
    }

    return { clicked: true, moved: false, reason: "Clicked but no detected step change", buttonLabel }
  } catch (error) {
    return {
      clicked: false,
      moved: false,
      reason: error instanceof Error ? error.message : "Failed to click button"
    }
  }
}

async function fillApplicationWithValidationRetry() {
  const allAnswers = new Map<string, Answer>()
  const retryDiagnostics: string[] = []
  let latestInjection: any = null

  const initialFill = await fillApplication()
  if (!initialFill.success) return initialFill

  const initialAnswers = initialFill.data?.answers || []
  initialAnswers.forEach((answer: Answer) => {
    if (answer.field_id) allAnswers.set(answer.field_id, answer)
  })

  if (initialAnswers.length > 0) {
    const initialInject = await injectAnswers(initialAnswers)
    if (initialInject.success) {
      latestInjection = initialInject.data
    }
  }

  let completedRounds = 0
  for (let round = 1; round <= MAX_VALIDATION_RETRY_ROUNDS; round++) {
    await sleep(300)
    detectForms()
    const primaryForm = getPrimaryForm()
    if (!primaryForm) break

    const { deltaFieldIds, validationErrors } = collectValidationDelta(primaryForm)
    const missingIds = Array.from(deltaFieldIds).filter((fieldId) => !allAnswers.has(fieldId))

    if (validationErrors.length) {
      retryDiagnostics.push(...validationErrors.map((message) => `[round ${round}] ${message}`))
    }

    if (missingIds.length === 0) {
      completedRounds = round - 1
      break
    }

    console.log(`[Flash Content] Retry round ${round}, missing fields:`, missingIds)
    const deltaFill = await fillApplication(new Set(missingIds))
    if (!deltaFill.success) {
      return {
        success: false,
        error: deltaFill.error || "Failed to generate missing field answers",
        data: {
          answers: Array.from(allAnswers.values()),
          retryDiagnostics,
          retryRounds: round
        }
      }
    }

    const deltaAnswers = (deltaFill.data?.answers || []).filter((answer: Answer) => answer?.field_id)
    if (deltaAnswers.length === 0) {
      completedRounds = round
      break
    }

    deltaAnswers.forEach((answer: Answer) => allAnswers.set(answer.field_id, answer))
    const deltaInject = await injectAnswers(deltaAnswers)
    if (deltaInject.success) {
      latestInjection = deltaInject.data
    }
    completedRounds = round
  }

  detectForms()
  const postForm = getPrimaryForm()
  const unresolvedFieldIds = postForm
    ? Array.from(collectValidationDelta(postForm).deltaFieldIds).filter((fieldId) => !allAnswers.has(fieldId))
    : []

  let autoAdvance: {
    clicked: boolean
    moved: boolean
    reason: string
    buttonLabel?: string
  } | null = null

  if (postForm && unresolvedFieldIds.length === 0) {
    autoAdvance = await autoAdvanceToNextStep(postForm)
    if (autoAdvance.clicked) {
      updateStatus(autoAdvance.moved ? "advanced to next step" : "clicked continue", true)
    }
  }

  return {
    success: true,
    data: {
      answers: Array.from(allAnswers.values()),
      injection: latestInjection,
      retryRounds: completedRounds,
      unresolvedFieldIds,
      retryDiagnostics,
      autoAdvance
    }
  }
}

async function autoAdvanceOnce() {
  detectForms()
  const primaryForm = getPrimaryForm()
  if (!primaryForm) {
    return { success: false, error: "No form available for auto-advance" }
  }

  const result = await autoAdvanceToNextStep(primaryForm)
  return { success: true, data: result }
}

async function clickSignInOnce() {
  const candidates = document.querySelectorAll(
    'button, input[type="submit"], input[type="button"], [role="button"]'
  )

  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement)) continue
    if (!isButtonEnabled(candidate)) continue
    const label = getElementLabel(candidate)
    if (!label.includes("sign in") && !label.includes("log in") && !label.includes("login")) {
      continue
    }

    candidate.scrollIntoView({ block: "center", behavior: "smooth" })
    await sleep(100)
    candidate.click()
    console.log("[Flash Content] Sign In clicked", { buttonLabel: label })
    return { success: true, data: { clicked: true, buttonLabel: label } }
  }

  return { success: false, error: "Sign In button not found" }
}

async function injectAnswers(answers: Answer[]) {
  console.log("[Flash Content] injectAnswers called with", answers.length, "answers")
  
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) {
    return { success: false, error: "No form fields available for injection" }
  }

  updateStatus("injecting answers", true)
  const primaryForm = forms.forms[0]
  const answersMap = mapAnswersByFieldId(answers)
  answersMap.forEach((_answer, fieldId) => {
    console.log("[Flash Content] Mapping answer for field:", fieldId)
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

    // Step 1: Fill application with validation-aware retries
    const fillResponse = await fillApplicationWithValidationRetry()
    
    if (!fillResponse.success) {
      console.error("[Flash AutoFill] Failed to generate answers:", fillResponse.error)
      updateStatus(`❌ auto-fill failed: ${fillResponse.error}`, true)
      isProcessingForm = false
      return
    }

    const answers = fillResponse.data?.answers || []
    const injection = fillResponse.data?.injection
    const retryRounds = fillResponse.data?.retryRounds || 0
    console.log(`[Flash AutoFill] Generated ${answers.length} answers`)

    if (injection) {
      console.log(`[Flash AutoFill] Injection complete: ${injection.filled}/${injection.total} fields`)
      updateStatus(`filled ${injection.filled} fields`, true)
      showNotification(
        "Form Auto-Filled",
        `Filled ${injection.filled} fields with ${retryRounds} retry rounds. Please review before submitting.`,
        "success"
      )
    } else {
      console.warn("[Flash AutoFill] No injection summary returned")
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
      
      case "FILL_APPLICATION_WITH_RETRY":
        sendResponse(await fillApplicationWithValidationRetry())
        break

      case "AUTO_ADVANCE_ONCE":
        sendResponse(await autoAdvanceOnce())
        break
      
      case "AUTO_CLICK_SIGNIN":
        sendResponse(await clickSignInOnce())
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
