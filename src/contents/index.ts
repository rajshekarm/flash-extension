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
import { flashSyncStorage } from "~lib/storage/chrome"
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

  statusIndicator.textContent = `Flash: ${message}`
  statusIndicator.style.opacity = show ? "1" : "0"
}

function extractJobInfo(): ExtractedJobInfo | null {
  try {
    updateStatus("scanning job", true)
    const jobInfo = jobExtractor.extractJobInfo()
    if (jobInfo?.title || jobInfo?.description) {
      latestJobInfo = jobInfo
      updateStatus("job detected", true)
      
      // Debug output
      console.log("[Flash Debug] Extracted Job Info:", {
        title: jobInfo.title,
        company: jobInfo.company,
        location: jobInfo.location,
        url: jobInfo.url,
        descriptionLength: jobInfo.description?.length || 0,
        requirementsCount: jobInfo.requirements?.length || 0
      })
      
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
          confidence: form.confidence,
          fieldCount: form.fields.length,
          fields: form.fields.map(f => ({ label: f.label, type: f.type, required: f.required }))
        }))
      })
    }
    return formData
  } catch (error) {
    console.error("[Flash Content] Error detecting forms:", error)
  }
  return null
}

async function analyzeJob() {
  const jobInfo = latestJobInfo ?? extractJobInfo()
  if (!jobInfo?.description || !jobInfo?.title) {
    return { success: false, error: "Job information not found on this page" }
  }

  updateStatus("analyzing job", true)
  const jobDescription: JobDescription = {
    title: jobInfo.title || "",
    company: jobInfo.company || "",
    description: jobInfo.description || "",
    requirements: jobInfo.requirements || [],
    url: jobInfo.url,
    location: jobInfo.location
  }

  return await sendToBackground({
    name: "analyzeJob",
    body: { jobDescription }
  })
}

async function fillApplication() {
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) {
    return { success: false, error: "No application form detected" }
  }

  const userProfile = await flashSyncStorage.get("userProfile")
  if (!userProfile?.id) {
    return { success: false, error: "User profile not found" }
  }

  const primaryForm = forms.forms[0]
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
  return await sendToBackground({
    name: "fillApplication",
    body: {
      formFields,
      userId: userProfile.id
    }
  })
}

async function injectAnswers(answers: Answer[]) {
  const forms = latestForms ?? detectForms()
  if (!forms?.forms?.length) {
    return { success: false, error: "No form fields available for injection" }
  }

  updateStatus("injecting answers", true)
  const primaryForm = forms.forms[0]
  const answersMap = new Map<string, string>()
  answers.forEach((answer) => {
    if (answer.field_id) {
      answersMap.set(answer.field_id, answer.answer)
    }
  })

  const result = await fieldInjector.injectAnswers(primaryForm.fields, answersMap)
  updateStatus("injection complete", true)
  return { success: true, data: result }
}

function setupMutationObserver() {
  const scan = debounce(() => {
    extractJobInfo()
    detectForms()
  }, 1000)

  const observer = new MutationObserver(() => {
    scan()
  })

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }
}

function initialScan() {
  updateStatus("starting scan", true)
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

      default:
        sendResponse({ success: false, error: "Unknown message type" })
        break
    }
  })()

  return true
})