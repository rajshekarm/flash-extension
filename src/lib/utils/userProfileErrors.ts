// User Profile Error Handling Utilities

export interface UserProfileError {
  type: 'NETWORK' | 'VALIDATION' | 'NOT_FOUND' | 'DUPLICATE' | 'SERVER' | 'UNKNOWN';
  message: string;
  details?: any;
}

/**
 * Converts various error types to user-friendly UserProfileError
 */
export function parseUserProfileError(error: any): UserProfileError {
  if (typeof error === 'string') {
    return { type: 'UNKNOWN', message: error };
  }

  if (!error || typeof error !== 'object') {
    return { type: 'UNKNOWN', message: 'An unexpected error occurred' };
  }

  const errorMessage = error.message || error.error || 'Unknown error';

  // Check for specific "email already registered" errors first
  if (
    errorMessage.toLowerCase().includes('email already registered') ||
    errorMessage.toLowerCase().includes('email is already registered') ||
    (error.statusCode === 400 && errorMessage.toLowerCase().includes('already registered'))
  ) {
    return {
      type: 'DUPLICATE',
      message: 'This email is already registered. Please try logging in instead or use a different email address.',
      details: errorMessage
    };
  }

  // Network-related errors
  if (
    errorMessage.includes('unreachable') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('NetworkError') ||
    error.code === 'NETWORK_ERROR'
  ) {
    return {
      type: 'NETWORK',
      message: 'Cannot connect to the backend server. Your profile will be saved locally and synced when connection is restored.',
      details: errorMessage
    };
  }

  // Validation errors
  if (
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('invalid') ||
    error.code === 'VALIDATION_ERROR' ||
    error.statusCode === 400
  ) {
    return {
      type: 'VALIDATION',
      message: 'Profile data is invalid. Please check that name and email are provided and properly formatted.',
      details: errorMessage
    };
  }

  // Not found errors
  if (
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    error.statusCode === 404
  ) {
    return {
      type: 'NOT_FOUND',
      message: 'User profile not found. It may have been deleted or moved.',
      details: errorMessage
    };
  }

  // Duplicate/conflict errors  
  if (
    errorMessage.includes('already exists') ||
    errorMessage.includes('duplicate') ||
    errorMessage.includes('conflict') ||
    errorMessage.toLowerCase().includes('already registered') ||
    error.statusCode === 409 ||
    (error.statusCode === 400 && (
      errorMessage.toLowerCase().includes('already') ||
      errorMessage.toLowerCase().includes('exists')
    ))
  ) {
    return {
      type: 'DUPLICATE',
      message: 'A profile with this email already exists. Please use a different email address or try logging in.',
      details: errorMessage
    };
  }

  // Server errors
  if (
    error.statusCode >= 500 ||
    errorMessage.includes('server error') ||
    errorMessage.includes('internal error')
  ) {
    return {
      type: 'SERVER',
      message: 'Server is experiencing issues. Your profile will be saved locally and synced when the server is back online.',
      details: errorMessage
    };
  }

  // Default to unknown
  return {
    type: 'UNKNOWN',
    message: errorMessage || 'An unexpected error occurred while managing your profile.',
    details: error
  };
}

/**
 * Get user-friendly error message for display in UI
 */
export function getUserFriendlyErrorMessage(error: UserProfileError): string {
  switch (error.type) {
    case 'NETWORK':
      return '🌐 Connection Issue\n\n' + error.message;
    case 'VALIDATION':
      return '⚠️ Invalid Data\n\n' + error.message;
    case 'NOT_FOUND':
      return '🔍 Profile Not Found\n\n' + error.message;
    case 'DUPLICATE':
      // Special handling for email already registered
      if (error.details?.toLowerCase().includes('email already registered')) {
        return '📧 Email Already Registered\n\nThis email address is already associated with an account.';
      }
      return '👥 Duplicate Profile\n\n' + error.message;
    case 'SERVER':
      return '🛠️ Server Issue\n\n' + error.message;
    default:
      return '❌ Error\n\n' + error.message;
  }
}

/**
 * Get appropriate action suggestions based on error type
 */
export function getErrorActionSuggestions(error: UserProfileError): string[] {
  switch (error.type) {
    case 'NETWORK':
      return [
        'Check your internet connection',
        'Try again in a few moments',
        'Profile will sync automatically when connection is restored'
      ];
    case 'VALIDATION':
      return [
        'Ensure name and email fields are filled',
        'Check email format (e.g., user@domain.com)',
        'Verify all required fields have valid data'
      ];
    case 'NOT_FOUND':
      return [
        'Try refreshing the extension',
        'Create a new profile if needed',
        'Contact support if this persists'
      ];
    case 'DUPLICATE':
      // Special suggestions for email already registered
      if (error.details?.toLowerCase().includes('email already registered')) {
        return [
          'Click the "Sign in" link to log into your existing account',
          'Use a different email address if you want a new account',
          'Reset your password if you forgot it'
        ];
      }
      return [
        'Use a different email address',
        'Check if you already have an account',
        'Try updating your existing profile instead'
      ];
    case 'SERVER':
      return [
        'Wait a few minutes and try again',
        'Your profile is saved locally in the meantime',
        'Check the extension status page for updates'
      ];
    default:
      return [
        'Try refreshing the extension',
        'Check your internet connection',
        'Contact support if this issue persists'
      ];
  }
}

/**
 * Determines if the operation should retry automatically
 */
export function shouldRetryOperation(error: UserProfileError, attemptCount: number): boolean {
  if (attemptCount >= 3) return false;
  
  return error.type === 'NETWORK' || error.type === 'SERVER';
}

/**
 * Get retry delay in milliseconds with exponential backoff
 */
export function getRetryDelay(attemptCount: number): number {
  return Math.min(1000 * Math.pow(2, attemptCount - 1), 8000);
}