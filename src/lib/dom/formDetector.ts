// Form Detector - Identifies application forms on job pages
import type {
  DetectedForm,
  DetectedFormField,
  FormMetadata,
  FormScore,
  FieldType,
  SelectOption,
} from '~types';
import { generateId } from '../utils/helpers';

export class FormDetector {
  private readonly debug = false;

  /**
   * Detect all forms on the current page
   */
  detectForms(): FormMetadata | null {
    const forms = document.querySelectorAll('form');
    const detectedForms: DetectedForm[] = [];

    forms.forEach((form) => {
      const score = this.scoreForm(form);
      const fields = this.extractFields(form);
      
      // Include forms with at least 1 fillable field OR high confidence score
      // This catches account creation, login, and all application forms
      // Note: Password fields are excluded for security, so even simple forms qualify
      const shouldInclude = fields.length >= 1 || score.score > 0.3;
      
      if (shouldInclude) {
        this.logDetectedFields(fields, 'native-form');
        detectedForms.push({
          element: form,
          action: form.action,
          method: form.method,
          fields,
          submitButton: this.findSubmitButton(form),
          score: score.score,
        });
      }
    });

    // Fallback: many SPA flows (e.g. Workday) render inputs without a <form> wrapper.
    if (detectedForms.length === 0) {
      const virtualForm = this.detectVirtualForm();
      if (virtualForm) {
        detectedForms.push(virtualForm);
      }
    }

    if (detectedForms.length === 0) return null;

    return {
      url: window.location.href,
      domain: window.location.hostname,
      title: document.title,
      company: this.extractCompanyName(),
      detectedAt: new Date().toISOString(),
      forms: detectedForms,
    };
  }

  /**
   * Detect form-like containers when no native <form> exists
   */
  private detectVirtualForm(): DetectedForm | null {
    const selectors = ['main', '[role="main"]', '[role="form"]', 'section', 'article', 'div'];
    const candidates: HTMLElement[] = [];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el instanceof HTMLElement) {
          candidates.push(el);
        }
      });
    });

    let bestContainer: HTMLElement | null = null;
    let bestFieldCount = 0;

    for (const container of candidates) {
      // Skip tiny/utility containers quickly
      if ((container.textContent || '').trim().length < 20) continue;
      const fields = container.querySelectorAll('input, textarea, select');
      if (fields.length > bestFieldCount) {
        bestFieldCount = fields.length;
        bestContainer = container;
      }
    }

    if (!bestContainer || bestFieldCount < 2) return null;

    const score = this.scoreContainer(bestContainer);
    const fields = this.extractFields(bestContainer);
    if (fields.length === 0) return null;
    this.logDetectedFields(fields, 'virtual-form');

    return {
      element: bestContainer as unknown as HTMLFormElement,
      action: window.location.href,
      method: 'post',
      fields,
      submitButton: this.findSubmitButton(bestContainer),
      score: score.score,
    };
  }

  /**
   * Score a form to determine if it's an application form
   */
  private scoreForm(form: HTMLFormElement): FormScore {
    let score = 0;
    const reasons: string[] = [];
    const indicators = {
      hasResumeUpload: false,
      hasTextArea: false,
      hasWorkHistory: false,
      hasKeywords: false,
      fieldCount: 0,
    };

    const html = form.innerHTML.toLowerCase();
    const formText = form.textContent?.toLowerCase() || '';

    // Check for resume/CV upload
    const fileInputs = form.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      indicators.hasResumeUpload = true;
      score += 0.3;
      reasons.push('Has file upload field');
    }

    // Check for textarea (cover letter, additional info)
    const textareas = form.querySelectorAll('textarea');
    if (textareas.length > 0) {
      indicators.hasTextArea = true;
      score += 0.2;
      reasons.push('Has textarea fields');
    }

    // Check for application-related keywords
    const keywords = [
      'apply',
      'application',
      'resume',
      'cv',
      'cover letter',
      'experience',
      'education',
      'qualification',
      'employment',
      'career',
      'job application',
      'submit application',
    ];

    const foundKeywords = keywords.filter(
      (keyword) => html.includes(keyword) || formText.includes(keyword)
    );

    if (foundKeywords.length > 0) {
      indicators.hasKeywords = true;
      score += Math.min(foundKeywords.length * 0.1, 0.3);
      reasons.push(`Contains keywords: ${foundKeywords.join(', ')}`);
    }

    // Check for work history fields
    const workHistoryKeywords = ['company', 'employer', 'job title', 'position'];
    const hasWorkHistory = workHistoryKeywords.some(
      (keyword) => html.includes(keyword) || formText.includes(keyword)
    );

    if (hasWorkHistory) {
      indicators.hasWorkHistory = true;
      score += 0.15;
      reasons.push('Contains work history fields');
    }

    // Check field count (application forms usually have many fields)
    const inputs = form.querySelectorAll('input, textarea, select');
    indicators.fieldCount = inputs.length;

    if (inputs.length >= 5) {
      score += 0.1;
      reasons.push(`Has ${inputs.length} form fields`);
    }

    if (inputs.length >= 10) {
      score += 0.1;
      reasons.push('Has many form fields (likely application)');
    }

    return {
      isApplicationForm: score >= 0.5,
      score: Math.min(score, 1.0),
      reasons,
      indicators,
    };
  }

  /**
   * Score non-form containers with the same heuristic
   */
  private scoreContainer(container: Element): FormScore {
    let score = 0;
    const reasons: string[] = [];
    const indicators = {
      hasResumeUpload: false,
      hasTextArea: false,
      hasWorkHistory: false,
      hasKeywords: false,
      fieldCount: 0,
    };

    const html = container.innerHTML.toLowerCase();
    const formText = container.textContent?.toLowerCase() || '';

    const fileInputs = container.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      indicators.hasResumeUpload = true;
      score += 0.3;
      reasons.push('Has file upload field');
    }

    const textareas = container.querySelectorAll('textarea');
    if (textareas.length > 0) {
      indicators.hasTextArea = true;
      score += 0.2;
      reasons.push('Has textarea fields');
    }

    const keywords = [
      'apply',
      'application',
      'resume',
      'cv',
      'cover letter',
      'experience',
      'education',
      'qualification',
      'employment',
      'career',
      'job application',
      'submit application',
    ];

    const foundKeywords = keywords.filter(
      (keyword) => html.includes(keyword) || formText.includes(keyword)
    );

    if (foundKeywords.length > 0) {
      indicators.hasKeywords = true;
      score += Math.min(foundKeywords.length * 0.1, 0.3);
      reasons.push(`Contains keywords: ${foundKeywords.join(', ')}`);
    }

    const workHistoryKeywords = ['company', 'employer', 'job title', 'position'];
    const hasWorkHistory = workHistoryKeywords.some(
      (keyword) => html.includes(keyword) || formText.includes(keyword)
    );

    if (hasWorkHistory) {
      indicators.hasWorkHistory = true;
      score += 0.15;
      reasons.push('Contains work history fields');
    }

    const inputs = container.querySelectorAll('input, textarea, select');
    indicators.fieldCount = inputs.length;

    if (inputs.length >= 5) {
      score += 0.1;
      reasons.push(`Has ${inputs.length} form fields`);
    }

    if (inputs.length >= 10) {
      score += 0.1;
      reasons.push('Has many form fields (likely application)');
    }

    return {
      isApplicationForm: score >= 0.5,
      score: Math.min(score, 1.0),
      reasons,
      indicators,
    };
  }

  /**
   * Extract all fields from a form
   */
  private extractFields(form: ParentNode): DetectedFormField[] {
    const fields: DetectedFormField[] = [];
    const fieldElements = form.querySelectorAll(
      'input, textarea, select, [role="combobox"], [aria-haspopup="listbox"]'
    );
    const seen = new Set<HTMLElement>();

    fieldElements.forEach((element) => {
      const htmlElement = element as HTMLElement;
      if (seen.has(htmlElement)) return;
      seen.add(htmlElement);

      const field = this.extractField(htmlElement);
      if (field && !this.shouldSkipField(field)) {
        fields.push(field);
      }
    });

    return this.dedupeFields(fields);
  }

  /**
   * Deduplicate logical fields rendered as multiple DOM controls
   * (common with custom dropdown widgets that expose both combobox + input)
   */
  private dedupeFields(fields: DetectedFormField[]): DetectedFormField[] {
    const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
    const isGenericLabel = (label: string) => {
      const normalized = normalize(label);
      return (
        !normalized ||
        normalized === 'unnamed field' ||
        normalized === 'select one' ||
        normalized === 'select one required' ||
        normalized === 'required'
      );
    };

    const scoreField = (field: DetectedFormField): number => {
      let score = 0;
      if (field.type === 'select') score += 5;
      if (field.options && field.options.length > 0) score += 4;
      if (field.required) score += 2;
      if (!isGenericLabel(field.label)) score += 2;
      if (field.name) score += 1;
      if (field.type === 'text') score -= 1;
      return score;
    };

    const bestByKey = new Map<string, DetectedFormField>();

    for (const field of fields) {
      const keyLabel = !isGenericLabel(field.label) ? normalize(field.label) : '';
      const keyName = normalize(field.name || '');
      const dedupeKey = keyLabel || keyName || normalize(field.id);

      const existing = bestByKey.get(dedupeKey);
      if (!existing) {
        bestByKey.set(dedupeKey, field);
        continue;
      }

      if (scoreField(field) > scoreField(existing)) {
        bestByKey.set(dedupeKey, field);
      }
    }

    return Array.from(bestByKey.values());
  }

  /**
   * Extract information from a single field
   */
  private extractField(element: HTMLElement): DetectedFormField | null {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) &&
      !this.isCustomSelectElement(element)
    ) {
      return null;
    }

    const inputName =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ? element.name
        : '';
    const id = element.id || inputName || element.getAttribute('name') || generateId();
    const name =
      inputName ||
      element.getAttribute('name') ||
      element.getAttribute('data-automation-id') ||
      element.id ||
      '';
    const label = this.extractLabel(element);
    const type = this.determineFieldType(element);
    const required = element.hasAttribute('required') || element.getAttribute('aria-required') === 'true';
    const placeholder = element.getAttribute('placeholder') || element.getAttribute('aria-placeholder') || '';

    // Extract options for select/radio fields
    let options: SelectOption[] | undefined;
    if (element instanceof HTMLSelectElement) {
      options = this.extractSelectOptions(element);
    } else if (type === 'select') {
      options = this.extractCustomSelectOptions(element);
    }

    // Extract current value
    const value = this.extractFieldValue(element);

    // Extract validation rules
    const validation = {
      pattern: element.getAttribute('pattern') || undefined,
      min: element.getAttribute('min') ? Number(element.getAttribute('min')) : undefined,
      max: element.getAttribute('max') ? Number(element.getAttribute('max')) : undefined,
      minLength: element.getAttribute('minlength') ? Number(element.getAttribute('minlength')) : undefined,
      maxLength: element.getAttribute('maxlength') ? Number(element.getAttribute('maxlength')) : undefined,
      required,
    };

    // Extract all attributes
    const attributes: Record<string, string> = {};
    Array.from(element.attributes).forEach((attr) => {
      attributes[attr.name] = attr.value;
    });

    return {
      id,
      name,
      label,
      type,
      element,
      required,
      placeholder,
      options,
      value,
      validation,
      attributes,
    };
  }

  /**
   * Determine the field type
   */
  private determineFieldType(element: HTMLElement): FieldType {
    if (element instanceof HTMLTextAreaElement) {
      return 'textarea';
    }

    if (this.isCustomSelectElement(element)) {
      return 'select';
    }

    if (element instanceof HTMLSelectElement) {
      return 'select';
    }

    if (element instanceof HTMLInputElement) {
      return element.type as FieldType;
    }

    return 'text';
  }

  private isCustomSelectElement(element: HTMLElement): boolean {
    const isTextLikeInput =
      element instanceof HTMLInputElement &&
      (element.type === 'text' || element.type === 'search' || element.type === '');
    const role = element.getAttribute('role')?.toLowerCase();
    const ariaHasPopup = element.getAttribute('aria-haspopup')?.toLowerCase();
    const ariaAutocomplete = element.getAttribute('aria-autocomplete')?.toLowerCase();
    const ariaExpanded = element.getAttribute('aria-expanded');
    const ariaControls = element.getAttribute('aria-controls');
    const automationId = element.getAttribute('data-automation-id')?.toLowerCase() || '';
    const className = element.className?.toString().toLowerCase() || '';
    const parentRole = element.closest('[role]')?.getAttribute('role')?.toLowerCase() || '';

    if (role === 'combobox' || role === 'listbox') return true;
    if (ariaHasPopup === 'listbox') return true;
    if (parentRole === 'combobox') return true;
    if (isTextLikeInput && (ariaAutocomplete === 'list' || ariaAutocomplete === 'both')) return true;
    if (isTextLikeInput && ariaControls && ariaExpanded !== null) return true;
    if (automationId.includes('select') || automationId.includes('dropdown')) return true;
    if (className.includes('combobox') || className.includes('dropdown')) return true;

    return false;
  }

  private extractFieldValue(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement
  ): string {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      return element.value || '';
    }

    return (
      element.getAttribute('aria-valuetext') ||
      element.getAttribute('aria-label') ||
      element.textContent?.trim() ||
      ''
    );
  }

  /**
   * Extract label for a field
   */
  private extractLabel(element: HTMLElement): string {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').replace(/\*/g, '').trim();
    const isUseful = (value: string) => {
      const v = normalize(value).toLowerCase();
      if (!v) return false;
      if (v === 'required' || v === 'optional') return false;
      if (v === 'select one' || v === 'select one required' || v === 'no required') return false;
      if (v.startsWith('select one')) return false;
      return true;
    };

    // Try aria-labelledby first (common for custom Workday controls)
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const ariaText = ariaLabelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean)
        .join(' ')
        .trim();
      if (isUseful(ariaText)) return normalize(ariaText);
    }

    // Try to find associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label?.textContent && isUseful(label.textContent)) return normalize(label.textContent);
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const input = clone.querySelector('input, textarea, select');
      if (input) input.remove();
      const parentText = clone.textContent?.trim() || '';
      if (isUseful(parentText)) return normalize(parentText);
    }

    // Try fieldset legend (question groups)
    const fieldset = element.closest('fieldset');
    const legend = fieldset?.querySelector('legend');
    if (legend?.textContent && isUseful(legend.textContent)) {
      return normalize(legend.textContent);
    }

    // Try nearest prompt/question text in the same container
    const questionContainer =
      element.closest('[data-automation-id*="question"]') ||
      element.closest('[data-automation-id*="formField"]') ||
      element.closest('[role="group"]') ||
      element.parentElement;
    if (questionContainer instanceof HTMLElement) {
      const promptCandidate = questionContainer.querySelector(
        'label, [data-automation-id*="label"], [data-automation-id*="prompt"], [id*="label"], [id*="prompt"], p, h3, h4, span'
      ) as HTMLElement | null;
      const promptText = promptCandidate?.textContent?.trim() || '';
      if (isUseful(promptText)) return normalize(promptText);
    }

    // Try aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && isUseful(ariaLabel)) return normalize(ariaLabel);

    // Try placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder && isUseful(placeholder)) return normalize(placeholder);

    // Try name attribute
    if ('name' in element && element.name) {
      return String(element.name).replace(/[_-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }

    return 'Unnamed Field';
  }

  /**
   * Extract options from select element
   */
  private extractSelectOptions(select: HTMLSelectElement): SelectOption[] {
    const options: SelectOption[] = [];
    Array.from(select.options).forEach((option) => {
      options.push({
        value: option.value,
        label: option.textContent?.trim() || option.value,
        selected: option.selected,
      });
    });
    return options;
  }

  private extractCustomSelectOptions(element: HTMLElement): SelectOption[] {
    const options: SelectOption[] = [];
    const controlsId = element.getAttribute('aria-controls');

    let optionElements: HTMLElement[] = [];
    if (controlsId) {
      const controlled = document.getElementById(controlsId);
      if (controlled) {
        optionElements = Array.from(controlled.querySelectorAll('[role="option"], option')) as HTMLElement[];
      }
    }

    if (optionElements.length === 0) {
      optionElements = Array.from(
        document.querySelectorAll('[role="option"], [data-automation-id*="option"], option')
      ) as HTMLElement[];
    }

    const selectedText = this.extractFieldValue(element).toLowerCase();

    optionElements.forEach((opt, index) => {
      const label = opt.textContent?.trim() || opt.getAttribute('aria-label') || '';
      if (!label) return;
      options.push({
        value: opt.getAttribute('data-value') || label,
        label,
        selected:
          opt.getAttribute('aria-selected') === 'true' ||
          label.toLowerCase() === selectedText ||
          index === 0,
      });
    });

    return options;
  }

  /**
   * Find submit button in form
   */
  private findSubmitButton(form: ParentNode): HTMLButtonElement | undefined {
    // Look for button with type="submit"
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    if (submitBtn) return submitBtn;

    // Look for input with type="submit"
    const submitInput = form.querySelector('input[type="submit"]') as HTMLButtonElement;
    if (submitInput) return submitInput;

    // Look for button with submit-related text
    const buttons = form.querySelectorAll('button');
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      if (text.includes('submit') || text.includes('apply') || text.includes('send')) {
        return button as HTMLButtonElement;
      }
    }

    return undefined;
  }

  /**
   * Debug helper to print all detected fields
   */
  private logDetectedFields(fields: DetectedFormField[], source: string): void {
    if (!this.debug) return;
    console.log(`[FormDetector] Detected ${fields.length} fields from ${source}`);
    fields.forEach((field, index) => {
      console.log('[FormDetector] Field', {
        index,
        id: field.id,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder || '',
      });
    });
  }

  /**
   * Determine if field should be skipped
   */
  private shouldSkipField(field: DetectedFormField): boolean {
    // Skip hidden fields
    if (field.type === 'hidden') return true;

    // Skip password fields (security)
    // if (field.type === 'password') return true;

    // Skip fields with certain names (CSRF tokens, etc.)
    const skipNames = ['csrf', 'token', '_method', 'authenticity_token'];
    if (skipNames.some((name) => field.name.toLowerCase().includes(name))) {
      return true;
    }

    // Skip anonymous helper controls from custom widgets
    const generatedIdPattern = /^\d{10,}-[a-z0-9]{6,}$/i;
    const hasAnonymousId = generatedIdPattern.test(field.id) && !field.name;
    const hasNoLabelOrPlaceholder =
      (!field.label || field.label === 'Unnamed Field') && !field.placeholder;
    if (hasAnonymousId && hasNoLabelOrPlaceholder) {
      return true;
    }

    return false;
  }

  /**
   * Extract company name from page
   */
  private extractCompanyName(): string | undefined {
    // Try meta tags
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) {
      return ogSiteName.getAttribute('content') || undefined;
    }

    // Try common selectors
    const companySelectors = [
      '[data-company]',
      '.company-name',
      '.employer-name',
      '[class*="company"]',
      '[class*="employer"]',
    ];

    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }
}

// Export singleton instance
export const formDetector = new FormDetector();
