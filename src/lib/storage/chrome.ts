// Chrome Storage API wrapper with type safety

import { Storage } from '@plasmohq/storage';
import { sendToBackground } from '@plasmohq/messaging';
import type { StorageData } from '~types';

export class FlashStorage {
  private storage: Storage;

  constructor() {
    this.storage = new Storage({ area: 'local' });
  }

  // Generic get method
  async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | null> {
    try {
      const value = await this.storage.get(key);
      return (value ?? null) as StorageData[K] | null;
    } catch (error) {
      console.error(`Error getting ${String(key)} from storage:`, error);
      return null;
    }
  }

  // Generic set method
  async set<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): Promise<void> {
    try {
      await this.storage.set(key, value);
    } catch (error) {
      console.error(`Error setting ${String(key)} in storage:`, error);
      throw error;
    }
  }

  // Remove key
  async remove<K extends keyof StorageData>(key: K): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      console.error(`Error removing ${String(key)} from storage:`, error);
      throw error;
    }
  }

  // Clear all storage
  async clear(): Promise<void> {
    try {
      await this.storage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Watch for changes
  watch<K extends keyof StorageData>(
    key: K,
    callback: (newValue: StorageData[K] | null, oldValue: StorageData[K] | null) => void
  ): void {
    this.storage.watch({
      [key]: (c) => {
        callback(c.newValue, c.oldValue);
      },
    });
  }
}

// Sync storage for user preferences
export class FlashSyncStorage {
  private storage: Storage;

  constructor() {
    this.storage = new Storage({ area: 'sync' });
  }

  async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | null> {
    try {
      const value = await this.storage.get(key);
      return (value ?? null) as StorageData[K] | null;
    } catch (error) {
      console.error(`Error getting ${String(key)} from sync storage:`, error);
      return null;
    }
  }

  async set<K extends keyof StorageData>(
    key: K,
    value: StorageData[K]
  ): Promise<void> {
    try {
      await this.storage.set(key, value);
    } catch (error) {
      console.error(`Error setting ${String(key)} in sync storage:`, error);
      throw error;
    }
  }

  async remove<K extends keyof StorageData>(key: K): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      console.error(`Error removing ${String(key)} from sync storage:`, error);
      throw error;
    }
  }
}

// Session storage for tab-specific data
export class FlashSessionStorage {
  async get(key: string): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.session.get([key], (result) => {
        resolve(result[key] ?? null);
      });
    });
  }

  async set(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.session.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.session.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

// Create singleton instances
export const flashStorage = new FlashStorage();
export const flashSyncStorage = new FlashSyncStorage();
export const flashSessionStorage = new FlashSessionStorage();

// Helper functions for common operations
export async function getUserProfile(userId?: string) {
  // If we have a userId, try to get from backend via message handler
  if (userId) {
    try {
      const response = await sendMessage({
        name: 'getUserProfile',
        body: { userId }
      });
      
      if (response?.success) {
        return response.data;
      } else {
        console.warn('[getUserProfile] Background handler failed:', response?.error);
        // Fallback to local storage
        return await flashSyncStorage.get('userProfile');
      }
    } catch (error) {
      console.warn('[getUserProfile] Message failed, using local storage:', error);
      return await flashSyncStorage.get('userProfile');
    }
  }
  
  // No userId provided, get from local storage
  return await flashSyncStorage.get('userProfile');
}

export async function setUserProfile(profile: StorageData['userProfile']) {
  if (!profile) {
    throw new Error('Profile is required');
  }

  try {
    // If profile has an ID, update it; otherwise create a new one
    if (profile.id) {
      const response = await sendMessage({
        name: 'updateUserProfile',
        body: { userId: profile.id, profile }
      });
      
      if (response?.success) {
        return response.data;
      } else {
        console.warn('[setUserProfile] Update failed, saving locally:', response?.error);
        await flashSyncStorage.set('userProfile', profile);
        return profile;
      }
    } else {
      const response = await sendMessage({
        name: 'createUserProfile',
        body: { profile }
      });
      
      if (response?.success) {
        return response.data;
      } else {
        console.warn('[setUserProfile] Create failed, saving locally:', response?.error);
        // Generate a temporary ID if creation failed
        const localProfile = { ...profile, id: `local-${Date.now()}` };
        await flashSyncStorage.set('userProfile', localProfile);
        return localProfile;
      }
    }
  } catch (error) {
    console.error('[setUserProfile] Error:', error);
    // Fallback to local storage
    await flashSyncStorage.set('userProfile', profile);
    return profile;
  }
}

export async function createUserProfile(profile: Omit<StorageData['userProfile'], 'id'>) {
  if (!profile) {
    throw new Error('Profile is required');
  }

  try {
    const response = await sendMessage({
      name: 'createUserProfile',
      body: { profile }
    });
    
    if (response?.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to create profile');
    }
  } catch (error) {
    console.error('[createUserProfile] Error:', error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, profile: StorageData['userProfile']) {
  if (!userId || !profile) {
    throw new Error('User ID and profile are required');
  }

  try {
    const response = await sendMessage({
      name: 'updateUserProfile',
      body: { userId, profile }
    });
    
    if (response?.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to update profile');
    }
  } catch (error) {
    console.error('[updateUserProfile] Error:', error);
    throw error;
  }
}

export async function deleteUserProfile(userId: string) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const response = await sendMessage({
      name: 'deleteUserProfile',
      body: { userId }
    });
    
    if (response?.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to delete profile');
    }
  } catch (error) {
    console.error('[deleteUserProfile] Error:', error);
    throw error;
  }
}

export async function listUserProfiles() {
  try {
    const response = await sendMessage({
      name: 'listUserProfiles',
      body: {}
    });
    
    if (response?.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to list profiles');
    }
  } catch (error) {
    console.error('[listUserProfiles] Error:', error);
    throw error;
  }
}

// Helper function that automatically chooses the right messaging method
async function sendMessage(message: { name: string; body: any }) {
  // Add timeout wrapper to prevent hanging
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Message '${message.name}' timed out after 10 seconds - background script may not be responding`));
    }, 10000);
  });

  let messagePromise: Promise<any>;
  
  // Check if we're in a content script context
  if (typeof sendToBackground !== 'undefined') {
    messagePromise = sendToBackground(message as any);
  } else {
    // We're in extension context (popup, sidepanel, etc.)
    messagePromise = chrome.runtime.sendMessage(message);
  }

  return Promise.race([messagePromise, timeoutPromise]);
}

// Authentication helper functions

export async function login(email: string, password: string) {
  try {
    const response = await sendMessage({
      name: 'login',
      body: { email, password }
    });
    
    if (response?.success) {
      return response.data;
    } else {
      throw new Error(response?.error || 'Login failed');
    }
  } catch (error) {
    console.error('[login] Error:', error);
    throw error;
  }
}

export async function register(name: string, email: string, password: string, confirmPassword: string) {
  try {
    console.log('[register] Sending registration request to background...');
    const response = await sendMessage({
      name: 'register',
      body: { name, email, password, confirmPassword }
    });
    
    console.log('[register] Background response:', response);
    console.log('[register] Response details:', {
      success: response?.success,
      hasData: !!response?.data,
      hasError: !!response?.error,
      errorType: response?.errorType,
      warning: response?.warning
    });
    
    if (response?.success) {
      // Include warning in returned data if present
      const result = response.data;
      if (response.warning) {
        result.warning = response.warning;
      }
      return result;
    } else {
      console.log('[register] Registration failed, throwing error:', response?.error);
      throw new Error(response?.error || 'Registration failed');
    }
  } catch (error) {
    console.error('[register] Error in storage layer:', error);
    throw error;
  }
}

export async function logout() {
  try {
    const response = await sendMessage({
      name: 'logout',
      body: {}
    });
    
    if (response?.success) {
      return true;
    } else {
      throw new Error(response?.error || 'Logout failed');
    }
  } catch (error) {
    console.error('[logout] Error:', error);
    throw error;
  }
}

export async function checkAuth() {
  try {
    console.log('[checkAuth] Sending auth check message to background...');
    const response = await sendMessage({
      name: 'checkAuth',
      body: {}
    });
    
    console.log('[checkAuth] Received response:', response);
    
    if (response?.success) {
      return {
        authenticated: response.authenticated,
        user: response.data
      };
    } else {
      throw new Error(response?.error || 'Auth check failed');
    }
  } catch (error) {
    console.error('[checkAuth] Background communication failed:', error);
    
    // If background communication fails, check local storage directly
    console.log('[checkAuth] Falling back to local storage check...');
    
    try {
      const authSession = await flashStorage.get('authSession');
      const authToken = await flashStorage.get('authToken');
      
      if (authSession && authToken) {
        // Check if token is still valid
        const expiresAt = new Date(authSession.expires_at);
        const now = new Date();
        
        if (expiresAt > now) {
          console.log('[checkAuth] Using cached auth session as fallback');
          return {
            authenticated: true,
            user: authSession.user
          };
        } else {
          console.log('[checkAuth] Cached session expired');
          // Clear expired session
          await Promise.all([
            flashStorage.remove('authSession'),
            flashStorage.remove('authToken'),
            flashStorage.remove('refreshToken'),
          ]);
        }
      }
    } catch (storageError) {
      console.error('[checkAuth] Local storage fallback failed:', storageError);
    }
    
    return {
      authenticated: false,
      user: null
    };
  }
}

export async function getAuthSession() {
  return await flashStorage.get('authSession');
}

export async function getAuthToken() {
  return await flashStorage.get('authToken');
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    // Direct local check without background messages
    const authSession = await flashStorage.get('authSession');
    const authToken = await flashStorage.get('authToken');
    
    if (!authSession || !authToken) {
      return false;
    }
    
    // Check if token is not expired
    const expiresAt = new Date(authSession.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      // Clean up expired session
      await Promise.all([
        flashStorage.remove('authSession'),
        flashStorage.remove('authToken'),
        flashStorage.remove('refreshToken'),
      ]);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[isAuthenticated] Error:', error);
    return false;
  }
}

export async function getCurrentAuthUser() {
  try {
    // Try direct storage access first (faster and more reliable)
    const authSession = await flashStorage.get('authSession');
    
    if (authSession?.user) {
      // Check if token is not expired
      const expiresAt = new Date(authSession.expires_at);
      const now = new Date();
      
      if (expiresAt > now) {
        console.log('[getCurrentAuthUser] Using cached auth session');
        return authSession.user;
      } else {
        console.log('[getCurrentAuthUser] Token expired');
        // Clear expired session
        await Promise.all([
          flashStorage.remove('authSession'),
          flashStorage.remove('authToken'),
          flashStorage.remove('refreshToken'),
        ]);
        return null;
      }
    }
    
    // Fallback to checkAuth if no direct session
    console.log('[getCurrentAuthUser] Falling back to checkAuth');
    const authCheck = await checkAuth();
    return authCheck.user;
  } catch (error) {
    console.error('[getCurrentAuthUser] Error:', error);
    return null;
  }
}

export async function getAPISettings() {
  const settings = await flashSyncStorage.get('apiSettings');
  return settings ?? {
    baseURL: process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:8000',
    apiKey: '',
    timeout: 30000,
    connected: false,
  };
}

export async function setAPISettings(settings: StorageData['apiSettings']) {
  return await flashSyncStorage.set('apiSettings', settings);
}

export async function getPreferences() {
  const prefs = await flashSyncStorage.get('preferences');
  return prefs ?? {
    autoAnalyze: false,
    autoFill: false,
    minConfidence: 0.5,
    highlightFilled: true,
    enableNotifications: true,
    theme: 'auto',
  };
}

export async function setPreferences(preferences: StorageData['preferences']) {
  return await flashSyncStorage.set('preferences', preferences);
}

export async function getCurrentSession() {
  return await flashStorage.get('currentSession');
}

export async function setCurrentSession(session: StorageData['currentSession']) {
  return await flashStorage.set('currentSession', session);
}

export async function clearSession() {
  await flashStorage.remove('currentSession');
  await flashStorage.remove('formCache');
  await flashStorage.remove('answersCache');
}
