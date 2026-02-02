// Chrome Storage API wrapper with type safety

import { Storage } from '@plasmohq/storage';
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
export async function getUserProfile() {
  return await flashSyncStorage.get('userProfile');
}

export async function setUserProfile(profile: StorageData['userProfile']) {
  return await flashSyncStorage.set('userProfile', profile);
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
