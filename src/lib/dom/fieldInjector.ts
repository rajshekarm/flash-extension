// Field Injector - Injects answers into form fields
import type { DetectedFormField, InjectionResult, FormFillingStatus } from '~types';
import { sleep } from '../utils/helpers';

export class FieldInjector {
  private highlightColor = '#D1FAE5';
  private highlightBorder = '2px solid #10B981';

  /**
   * Inject answers into multiple fields
   */
  async injectAnswers(
    fields: DetectedFormField[],
    answers: Map<string, string>
  ): Promise<FormFillingStatus> {
    const results: InjectionResult[] = [];
    let filled = 0;
    let failed = 0;
    let skipped = 0;

    for (const field of fields) {
      const answer = answers.get(field.id) || answers.get(field.name);
      
      if (!answer) {
        skipped++;
        continue;
      }

      try {
        await this.injectField(field, answer);
        results.push({
          fieldId: field.id,
          success: true,
          value: answer,
        });
        filled++;
      } catch (error) {
        results.push({
          fieldId: field.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }

      // Small delay between injections to avoid detection
      await sleep(100);
    }

    return {
      total: fields.length,
      filled,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Inject answer into a single field
   */
  async injectField(field: DetectedFormField, value: string): Promise<void> {
    const element = field.element;

    if (!element || !document.body.contains(element)) {
      throw new Error('Field element not found in DOM');
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'phone':
      case 'url':
      case 'number':
      case 'date':
        await this.setInputValue(element as HTMLInputElement, value);
        break;

      case 'textarea':
        await this.setTextareaValue(element as HTMLTextAreaElement, value);
        break;

      case 'select':
        await this.setSelectValue(element as HTMLSelectElement, value);
        break;

      case 'radio':
        await this.setRadioValue(element as HTMLInputElement, value);
        break;

      case 'checkbox':
        await this.setCheckboxValue(element as HTMLInputElement, value);
        break;

      case 'file':
        // File inputs cannot be set programmatically for security reasons
        this.showFileUploadNotice(element, value);
        break;

      default:
        throw new Error(`Unsupported field type: ${field.type}`);
    }

    // Highlight the filled field
    this.highlightField(element);
  }

  /**
   * Set value for text input
   */
  private async setInputValue(input: HTMLInputElement, value: string): Promise<void> {
    // Focus the input
    input.focus();
    await sleep(50);

    // Clear existing value
    input.value = '';

    // Set new value
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch events to trigger validation and framework detection
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    // For React/Angular/Vue
    input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event('focusout', { bubbles: true }));

    await sleep(50);
    input.blur();
  }

  /**
   * Set value for textarea
   */
  private async setTextareaValue(textarea: HTMLTextAreaElement, value: string): Promise<void> {
    textarea.focus();
    await sleep(50);

    textarea.value = '';

    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(textarea, value);
    } else {
      textarea.value = value;
    }

    // Dispatch events
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    await sleep(50);
    textarea.blur();
  }

  /**
   * Set value for select dropdown
   */
  private async setSelectValue(select: HTMLSelectElement, value: string): Promise<void> {
    select.focus();
    await sleep(50);

    // Try exact match first
    let matched = false;
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i];
      if (option.value === value || option.textContent?.trim() === value) {
        select.selectedIndex = i;
        matched = true;
        break;
      }
    }

    // Try fuzzy match if exact match fails
    if (!matched) {
      const valueLower = value.toLowerCase();
      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        const optionText = option.textContent?.trim().toLowerCase() || '';
        const optionValue = option.value.toLowerCase();

        if (optionText.includes(valueLower) || optionValue.includes(valueLower)) {
          select.selectedIndex = i;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      throw new Error(`No matching option found for value: ${value}`);
    }

    // Dispatch events
    select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    select.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));

    await sleep(50);
    select.blur();
  }

  /**
   * Set value for radio button
   */
  private async setRadioValue(radio: HTMLInputElement, value: string): Promise<void> {
    // Find the radio button group
    const name = radio.name;
    const radios = document.querySelectorAll(
      `input[type="radio"][name="${name}"]`
    ) as NodeListOf<HTMLInputElement>;

    // Try to find matching radio button
    for (const r of radios) {
      const label = this.getRadioLabel(r);
      const radioValue = r.value.toLowerCase();
      const labelValue = label.toLowerCase();
      const targetValue = value.toLowerCase();

      if (radioValue === targetValue || labelValue === targetValue || labelValue.includes(targetValue)) {
        r.focus();
        await sleep(50);
        
        r.checked = true;
        
        r.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        r.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
        
        await sleep(50);
        r.blur();
        return;
      }
    }

    throw new Error(`No matching radio button found for value: ${value}`);
  }

  /**
   * Set value for checkbox
   */
  private async setCheckboxValue(checkbox: HTMLInputElement, value: string): Promise<void> {
    checkbox.focus();
    await sleep(50);

    // Interpret value as boolean
    const shouldCheck = ['true', 'yes', '1', 'on', 'checked'].includes(value.toLowerCase());
    
    if (checkbox.checked !== shouldCheck) {
      checkbox.checked = shouldCheck;
      
      checkbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      checkbox.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
    }

    await sleep(50);
    checkbox.blur();
  }

  /**
   * Get label text for radio button
   */
  private getRadioLabel(radio: HTMLInputElement): string {
    // Try associated label
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }

    // Try parent label
    const parentLabel = radio.closest('label');
    if (parentLabel?.textContent) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const input = clone.querySelector('input');
      if (input) input.remove();
      return clone.textContent.trim();
    }

    // Try next sibling text
    const nextSibling = radio.nextSibling;
    if (nextSibling?.nodeType === Node.TEXT_NODE) {
      return nextSibling.textContent?.trim() || '';
    }

    return radio.value;
  }

  /**
   * Show notice for file upload fields
   */
  private showFileUploadNotice(element: HTMLElement, filename: string): void {
    // Create notice element
    const notice = document.createElement('div');
    notice.style.cssText = `
      position: absolute;
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 12px;
      color: #92400E;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    notice.textContent = `📎 Please upload: ${filename}`;

    // Position near the file input
    const rect = element.getBoundingClientRect();
    notice.style.top = `${rect.bottom + window.scrollY + 5}px`;
    notice.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(notice);

    // Remove after 5 seconds
    setTimeout(() => notice.remove(), 5000);

    // Highlight the file input
    element.style.border = '2px solid #F59E0B';
    element.style.backgroundColor = '#FEF3C7';
  }

  /**
   * Highlight a filled field
   */
  private highlightField(element: HTMLElement): void {
    element.style.backgroundColor = this.highlightColor;
    element.style.border = this.highlightBorder;
    element.setAttribute('data-flash-filled', 'true');

    // Add a checkmark icon
    const checkmark = document.createElement('span');
    checkmark.textContent = '✓';
    checkmark.style.cssText = `
      position: absolute;
      color: #10B981;
      font-size: 16px;
      font-weight: bold;
      margin-left: -20px;
      z-index: 1000;
    `;

    element.parentElement?.appendChild(checkmark);
  }

  /**
   * Clear all field highlights
   */
  clearHighlights(): void {
    const filledFields = document.querySelectorAll('[data-flash-filled="true"]');
    filledFields.forEach((field) => {
      if (field instanceof HTMLElement) {
        field.style.backgroundColor = '';
        field.style.border = '';
        field.removeAttribute('data-flash-filled');
      }
    });

    // Remove checkmarks
    document.querySelectorAll('span[style*="position: absolute"]').forEach((span) => {
      if (span.textContent === '✓') {
        span.remove();
      }
    });
  }

  /**
   * Scroll field into view
   */
  scrollToField(field: DetectedFormField): void {
    field.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
}

// Export singleton instance
export const fieldInjector = new FieldInjector();
