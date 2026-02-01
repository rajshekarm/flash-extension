// Utility functions for validation

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  // Supports various phone formats
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidLinkedInURL(url: string): boolean {
  return isValidURL(url) && url.includes('linkedin.com/in/');
}

export function isValidGitHubURL(url: string): boolean {
  return isValidURL(url) && url.includes('github.com/');
}

export function validateField(
  value: string,
  type: string,
  required: boolean = false
): { valid: boolean; error?: string } {
  if (required && (!value || value.trim() === '')) {
    return { valid: false, error: 'This field is required' };
  }

  if (!value || value.trim() === '') {
    return { valid: true };
  }

  switch (type) {
    case 'email':
      if (!isValidEmail(value)) {
        return { valid: false, error: 'Invalid email format' };
      }
      break;
    case 'phone':
      if (!isValidPhone(value)) {
        return { valid: false, error: 'Invalid phone number format' };
      }
      break;
    case 'url':
      if (!isValidURL(value)) {
        return { valid: false, error: 'Invalid URL format' };
      }
      break;
    case 'linkedin_url':
      if (!isValidLinkedInURL(value)) {
        return { valid: false, error: 'Invalid LinkedIn URL' };
      }
      break;
    case 'github_url':
      if (!isValidGitHubURL(value)) {
        return { valid: false, error: 'Invalid GitHub URL' };
      }
      break;
  }

  return { valid: true };
}

export function sanitizeInput(input: string): string {
  // Remove any HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

export function validateResume(file: File): { valid: boolean; error?: string } {
  const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Resume must be PDF or Word document' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Resume file size must be less than 5MB' };
  }

  return { valid: true };
}
