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
  ApplicationQuestion,
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
let latestFormQuestions: ApplicationQuestion[] = []
let statusIndicator: HTMLDivElement | null = null
let autoFillEnabled = false
let isProcessingForm = false
let processedFormIds = new Set<string>()
let lastFormDetectionTime = 0
// const MAX_VALIDATION_RETRY_ROUNDS = 2

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
        userId: userProfile?.id,
        userProfile
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

function toQuestionId(prompt: string, fallback: string): string {
  const normalized = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  if (normalized) return `q_${normalized}`
  return `q_${fallback.replace(/[^a-zA-Z0-9]/g, "_")}`
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    result.push(trimmed)
  })
  return result
}

function extractOptionLabels(rawOptions: any[] | undefined): string[] {
  if (!rawOptions || rawOptions.length === 0) return []
  return uniqueStrings(
    rawOptions
      .map((option) => {
        if (typeof option === "string") return option
        if (option && typeof option === "object") {
          return option.label || option.value || ""
        }
        return ""
      })
      .filter(Boolean)
  )
}

function questionTypeFromFieldType(
  fieldType: FormField["type"]
): ApplicationQuestion["question_type"] {
  if (fieldType === "select" || fieldType === "radio") return "single_choice"
  if (fieldType === "checkbox") return "multi_choice"
  if (fieldType === "date") return "date"
  if (fieldType === "file") return "file"
  return "free_text"
}

function extractRadioGroupPrompt(field: any): string {
  const element = field?.element as HTMLElement | undefined
  if (!element) return field?.label || "Radio Question"

  const fieldsetLegend = element.closest("fieldset")?.querySelector("legend")?.textContent?.trim()
  if (fieldsetLegend) return fieldsetLegend.replace(/\*/g, "").trim()

  const container =
    element.closest('[data-automation-id*="question"]') ||
    element.closest('[data-automation-id*="formField"]') ||
    element.closest('[role="group"]') ||
    element.parentElement

  if (container instanceof HTMLElement) {
    const candidates = Array.from(
      container.querySelectorAll(
        'label, legend, [data-automation-id*="label"], [data-automation-id*="prompt"], p, h3, h4, span'
      )
    )
      .map((node) => (node.textContent || "").replace(/\*/g, "").trim())
      .filter((text) => text.length > 3)
      .filter((text) => {
        const lower = text.toLowerCase()
        return lower !== "yes" && lower !== "no"
      })
      .sort((a, b) => b.length - a.length)

    if (candidates.length > 0) return candidates[0]
  }

  return field?.label || "Radio Question"
}

function toFormQuestions(primaryForm: any, fieldIdFilter?: Set<string>): ApplicationQuestion[] {
  const scopedFields = fieldIdFilter
    ? primaryForm.fields.filter((field: any) => fieldIdFilter.has(field.id) || fieldIdFilter.has(field.name))
    : primaryForm.fields

  const questions: ApplicationQuestion[] = []
  const processedRadioGroups = new Set<string>()

  scopedFields.forEach((field: any, index: number) => {
    const fieldType = normalizeFieldType(field.type)
    const fieldId = field.id || field.name || `field_${index}`

    if (fieldType === "radio") {
      const radioGroupKey = field.name || `radio_${fieldId}`
      if (processedRadioGroups.has(radioGroupKey)) return
      processedRadioGroups.add(radioGroupKey)

      const groupFields = scopedFields.filter((candidate: any) => {
        const candidateType = normalizeFieldType(candidate.type)
        return candidateType === "radio" && (candidate.name || `radio_${candidate.id}`) === radioGroupKey
      })

      const prompt = extractRadioGroupPrompt(field)
      const options = uniqueStrings(
        groupFields
          .map((groupField: any) => groupField.label || groupField.value || "")
          .filter((value: string) => !!value)
      )
      const fieldIds = uniqueStrings(
        groupFields
          .map((groupField: any) => groupField.id || groupField.name || "")
          .filter((value: string) => !!value)
      )
      questions.push({
        question_id: toQuestionId(prompt, radioGroupKey),
        prompt,
        required: !!groupFields.some((groupField: any) => groupField.required),
        question_type: "single_choice",
        options,
        field_ids: fieldIds
      })
      return
    }

    const prompt = (field.label || field.name || `Field ${index + 1}`).replace(/\*/g, "").trim()
    const options = extractOptionLabels(field.options)

    questions.push({
      question_id: toQuestionId(prompt, fieldId),
      prompt,
      required: !!field.required,
      question_type: questionTypeFromFieldType(fieldType),
      options: options.length > 0 ? options : undefined,
      field_ids: [fieldId]
    })
  })

  return questions
}

function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function getQuestionByAnswer(
  answer: Answer,
  questionById: Map<string, ApplicationQuestion>,
  questionByPrompt: Map<string, ApplicationQuestion>
): ApplicationQuestion | null {
  if (answer.question_id && questionById.has(answer.question_id)) {
    return questionById.get(answer.question_id) || null
  }

  const answerPrompt = normalizeComparableText(answer.question || "")
  if (answerPrompt && questionByPrompt.has(answerPrompt)) {
    return questionByPrompt.get(answerPrompt) || null
  }

  return null
}

function resolveTargetFieldIdsForAnswer(answer: Answer, primaryForm: any): string[] {
  if (answer.field_id) return [answer.field_id]
  if (answer.field_ids && answer.field_ids.length > 0) return answer.field_ids

  const questionById = new Map<string, ApplicationQuestion>()
  const questionByPrompt = new Map<string, ApplicationQuestion>()
  latestFormQuestions.forEach((question) => {
    questionById.set(question.question_id, question)
    questionByPrompt.set(normalizeComparableText(question.prompt), question)
  })

  const question = getQuestionByAnswer(answer, questionById, questionByPrompt)
  if (!question) return []

  if (question.question_type === "single_choice" && question.field_ids.length > 1) {
    const target = normalizeComparableText(answer.answer || "")
    const fields = primaryForm?.fields || []

    for (const fieldId of question.field_ids) {
      const matchedField = fields.find(
        (field: any) =>
          field.id === fieldId ||
          field.name === fieldId
      )
      if (!matchedField) continue

      const candidateLabel = normalizeComparableText(
        matchedField.label || matchedField.value || matchedField.name || ""
      )
      const candidateValue = normalizeComparableText(
        matchedField.value || matchedField.attributes?.value || ""
      )

      if (
        target &&
        (candidateLabel === target ||
          candidateValue === target ||
          candidateLabel.includes(target) ||
          target.includes(candidateLabel))
      ) {
        return [fieldId]
      }
    }
  }

  return question.field_ids
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

  const formQuestions = toFormQuestions(primaryForm, fieldIdFilter)
  latestFormQuestions = formQuestions
  if (formQuestions.length === 0) {
    return { success: false, error: "No target questions available for answer generation" }
  }

  updateStatus("generating answers", true)
  console.log("Generating Answers to the fields")

  try {
    const response = await sendToBackground({
      name: "fillApplication",
      body: {
        questions: formQuestions,
        userId: userProfile.user_id,
        jobId,
        userProfile
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

function mapAnswersByFieldId(answers: Answer[], primaryForm: any): Map<string, string> {
  const answersMap = new Map<string, string>()
  answers.forEach((answer) => {
    const targetFieldIds = resolveTargetFieldIdsForAnswer(answer, primaryForm)
    targetFieldIds.forEach((fieldId) => {
      answersMap.set(fieldId, answer.answer)
    })
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
  const requiredEmptyFieldIds = new Set<string>()
  const invalidFieldIds = new Set<string>()
  const validationErrors: string[] = []
  const fields = primaryForm.fields || []

  fields.forEach((field: any) => {
    if (!field?.required) return
    if (!field?.element || !isElementVisible(field.element)) return
    if (isFieldEmpty(field)) {
      deltaFieldIds.add(field.id)
      requiredEmptyFieldIds.add(field.id)
    }
  })

  const invalidControls = document.querySelectorAll(
    'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"], [role="combobox"][aria-invalid="true"], [aria-haspopup="listbox"][aria-invalid="true"]'
  )
  invalidControls.forEach((control) => {
    const matched = findMatchingFieldForElement(fields, control as HTMLElement)
    if (matched?.id) {
      deltaFieldIds.add(matched.id)
      invalidFieldIds.add(matched.id)
    }
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
    if (matched?.id) {
      deltaFieldIds.add(matched.id)
      invalidFieldIds.add(matched.id)
    }
  })

  return {
    deltaFieldIds,
    requiredEmptyFieldIds,
    invalidFieldIds,
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

function isSignInLabel(label: string): boolean {
  return label.includes("sign in") || label.includes("log in") || label.includes("login")
}

function isAccountCreationLabel(label: string): boolean {
  return (
    label.includes("sign up") ||
    label.includes("signup") ||
    label.includes("create account") ||
    label.includes("register")
  )
}

function isContinueLabel(label: string): boolean {
  return label.includes("continue") || label.includes("save and continue")
}

function isLikelyLoginForm(primaryForm: any): boolean {
  const fields = primaryForm?.fields || []
  return fields.some((field: any) => field?.type === "password")
}

function findActionButton(primaryForm: any, intent: "advance" | "signin"): HTMLElement | null {
  const scopedRoot = (primaryForm?.element as ParentNode) || document
  const candidates = scopedRoot.querySelectorAll(
    'button[type="submit"], input[type="submit"], button, input[type="button"], [role="button"]'
  )
  const isLoginForm = isLikelyLoginForm(primaryForm)
  const ranked: Array<{ element: HTMLElement; label: string; score: number }> = []

  for (const candidate of candidates) {
    if (!(candidate instanceof HTMLElement)) continue
    if (!isButtonEnabled(candidate)) continue
    const label = getElementLabel(candidate)
    if (intent === "signin") {
      if (!isSignInLabel(label) && !isAccountCreationLabel(label)) continue
      const score = isSignInLabel(label) ? 100 : 90
      ranked.push({ element: candidate, label, score })
      continue
    }

    if (isLoginForm) {
      if (!isSignInLabel(label) && !isAccountCreationLabel(label)) continue
      const score = isSignInLabel(label) ? 100 : 90
      ranked.push({ element: candidate, label, score })
      continue
    }

    if (!isContinueLabel(label)) continue
    const score = label.includes("save and continue") ? 100 : 90
    ranked.push({ element: candidate, label, score })
  }

  if (ranked.length === 0) return null
  ranked.sort((a, b) => b.score - a.score)
  return ranked[0].element
}

async function autoAdvanceToNextStep(primaryForm: any) {
  console.log("[AutoAdvance] called")
  const button = findActionButton(primaryForm, "advance")
  if (!button) {
    return { clicked: false, moved: false, reason: "No eligible action button found (sign in/continue/save and continue)" }
  }

  const buttonLabel = getElementLabel(button)

  try {
    button.scrollIntoView({ block: "center", behavior: "smooth" })
    await sleep(150)
    button.click()
    console.log("[Flash Content] Auto-advance clicked:", buttonLabel)
    return { clicked: true, moved: true, reason: "Clicked action button", buttonLabel }
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
  let injectedAtLeastOnce = false

  const initialFill = await fillApplication()
  if (!initialFill.success) return initialFill


  const initialAnswers = initialFill.data?.answers || []
  initialAnswers.forEach((answer: Answer) => {
    const targetFieldIds = resolveTargetFieldIdsForAnswer(answer, getPrimaryForm())
    if (targetFieldIds.length > 0) {
      targetFieldIds.forEach((fieldId) => allAnswers.set(fieldId, answer))
      return
    }
    if (answer.field_id) allAnswers.set(answer.field_id, answer)
  })

    console.log("[Intiyisl FILL ANswers]", initialAnswers)

    
  if (initialAnswers.length > 0) {
    const initialInject = await injectAnswers(initialAnswers)
    if (initialInject.success) {
      latestInjection = initialInject.data
      injectedAtLeastOnce = true
    }
  }

  let completedRounds = 0
  let lastDeltaSummary: {
    requiredEmptyCount: number
    invalidCount: number
    sampleFieldIds: string[]
    sampleErrors: string[]
  } = {
    requiredEmptyCount: 0,
    invalidCount: 0,
    sampleFieldIds: [],
    sampleErrors: []
  }
  // Retry loop is intentionally disabled for now.
  // We go straight from initial injection to auto-advance.

  const postForm = getPrimaryForm()
  const postDelta = postForm ? collectValidationDelta(postForm) : null
  const unresolvedFieldIds = postDelta
    ? Array.from(postDelta.deltaFieldIds).filter((fieldId) => !allAnswers.has(fieldId))
    : []
  if (postDelta) {
    lastDeltaSummary = {
      requiredEmptyCount: postDelta.requiredEmptyFieldIds.size,
      invalidCount: postDelta.invalidFieldIds.size,
      sampleFieldIds: unresolvedFieldIds.slice(0, 5),
      sampleErrors: postDelta.validationErrors.slice(0, 3)
    }
  }

  let autoAdvance: {
    clicked: boolean
    moved: boolean
    reason: string
    buttonLabel?: string
  } | null = null

  // Always attempt to advance once injection is complete.
  if (postForm && injectedAtLeastOnce) {
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
      lastDeltaSummary,
      autoAdvance
    }
  }
}

async function autoAdvanceOnce() {
  const primaryForm = getPrimaryForm()
  if (!primaryForm) {
    return { success: false, error: "No form available for auto-advance" }
  }

  const result = await autoAdvanceToNextStep(primaryForm)
  return { success: true, data: result }
}

async function clickSignInOnce() {
  const primaryForm = getPrimaryForm()
  const button = findActionButton(primaryForm, "signin")
  if (button) {
    const label = getElementLabel(button)
    button.scrollIntoView({ block: "center", behavior: "smooth" })
    await sleep(100)
    button.click()
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
  const answersMap = mapAnswersByFieldId(answers, primaryForm)
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
