// Background Service Worker - Main entry point
// This is the brain of the extension that coordinates all operations

import { flashStorage, flashSyncStorage } from '~lib/storage/chrome';
import { flashAPI } from '~lib/api';
import type { Message, MessageResponse } from '~types';

console.log('[Flash Background] Service worker started');

// Initialize storage with default values
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Flash Background] Extension installed/updated', details.reason);

  if (details.reason === 'install') {
    // First time installation
    await initializeDefaultStorage();
    
    // Open welcome/onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('tabs/welcome.html'),
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log(`[Flash Background] Updated from ${details.previousVersion}`);
    // Perform any necessary migration
  }

  // Set up context menus
  setupContextMenus();
});
// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Flash Background] Browser started, restoring state...');
  
  // Restore any necessary state
  const session = await flashStorage.get('currentSession');
  if (session) {
    console.log('[Flash Background] Restored session:', session.id);
  }
});

// Handle messages from popup, content scripts, and sidepanel
// NOTE: This only handles non-Plasmo messages. Plasmo messages (with 'name' field) 
// are automatically routed to handlers in background/messages/
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // Ignore Plasmo messages - they have 'name' instead of 'type'
  // Plasmo's @plasmohq/messaging handles those automatically
  if ('name' in message && !('type' in message)) {
    // This is a Plasmo message, let Plasmo handle it
    console.log('[Flash Background] Plasmo message detected, skipping manual handler:', message);
    return false; // Let Plasmo's handler process it
  }

  console.log('[Flash Background] Received message:', message.type, sender.tab?.id);

  // Handle message asynchronously
  handleMessage(message, sender)
    .then((response) => {
      console.log("intermediate response", response)
      sendResponse(response);
    })
    .catch((error) => {
      console.error('[Flash Background] Error handling message:', error);
      sendResponse({
        success: false,
        error: error.message,
      });
    });

  // Return true to indicate we'll send response asynchronously
  return true;
});

// Handle tab updates (detect navigation to job boards)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isJobBoard = await checkIfJobBoard(tab.url);
    
    if (isJobBoard) {
      console.log('[Flash Background] Job board detected:', tab.url);
      
      // Update badge to indicate detection  
      try {
        chrome.action.setBadgeText({ text: '🎯', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#3B82F6', tabId });
      } catch (error) {
        console.warn('[Flash Background] Failed to update badge:', error);
      }
      
      // Note: Content script injection is handled automatically by Plasmo
      // based on the matches configuration in contents/index.ts
      
      // Check preferences for auto-open sidepanel
      try {
        const prefs = await flashSyncStorage.get('preferences');
        if (prefs?.autoOpenSidepanel) {
          chrome.sidePanel.open({ tabId });
          console.log('[Flash Background] Sidepanel opened automatically');
        }
        
        if (prefs?.autoAnalyze) {
          console.log('[Flash Background] Auto-analyze is enabled');
        }
      } catch (error) {
        console.warn('[Flash Background] Failed to check preferences:', error);
      }
    }
  }
});

// Handle tab activation (switch focus)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    const isJobBoard = await checkIfJobBoard(tab.url);
    if (isJobBoard) {
      chrome.action.setBadgeText({ text: '🎯', tabId: tab.id });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }
  }
});

/**
 * Main message handler
 */
async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  const { type, payload } = message;

  try {
    switch (type) {
      case 'GET_STATE':
        return await handleGetState();
      
      case 'GET_USER_PROFILE':
        return await handleGetUserProfile();
      
      case 'UPDATE_USER_PROFILE':
        return await handleUpdateUserProfile(payload);
      
      case 'OPEN_SIDEPANEL':
        return await handleOpenSidePanel(sender.tab?.id);
      
      case 'UPDATE_BADGE':
        return await handleUpdateBadge(payload);
      
      case 'CLEAR_SESSION':
        return await handleClearSession();
      
      default:
        return {
          success: false,
          error: `Unknown message type: ${type}`,
        };
    }
  } catch (error) {
    console.error('[Flash Background] Error in message handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current extension state
 */
async function handleGetState(): Promise<MessageResponse> {
  const session = await flashStorage.get('currentSession');
  const profile = await flashSyncStorage.get('userProfile');
  const prefs = await flashSyncStorage.get('preferences');

  return {
    success: true,
    data: {
      session,
      profile,
      preferences: prefs,
    },
  };
}

/**
 * Get user profile
 */
async function handleGetUserProfile(): Promise<MessageResponse> {
  const localProfile = await flashSyncStorage.get('userProfile');

  if (localProfile?.id) {
    try {
      const remoteProfile = await flashAPI.getUserProfile(localProfile.id);
      await flashSyncStorage.set('userProfile', remoteProfile);
      return {
        success: true,
        data: remoteProfile,
      };
    } catch (error) {
      console.warn('[Flash Background] Failed to fetch profile from backend, using local copy', error);
    }
  }

  return {
    success: true,
    data: localProfile,
  };
}

/**
 * Update user profile
 */
async function handleUpdateUserProfile(profile: any): Promise<MessageResponse> {
  if (!profile) {
    return {
      success: false,
      error: 'Profile data is required'
    };
  }

  await flashSyncStorage.set('userProfile', profile);

  try {
    const savedProfile = profile.id
      ? await flashAPI.updateUserProfile(profile.id, profile)
      : await flashAPI.createUserProfile(profile);

    await flashSyncStorage.set('userProfile', savedProfile);

    return {
      success: true,
      data: savedProfile,
    };
  } catch (error) {
    console.error('[Flash Background] Failed to sync profile with backend:', error);
    const errorMessage = error instanceof Error ? error.message : 'Profile sync failed';
    return {
      success: false,
      error: errorMessage,
      data: profile,
    };
  }
}

/**
 * Open side panel
 */
async function handleOpenSidePanel(tabId?: number): Promise<MessageResponse> {
  if (tabId) {
    await chrome.sidePanel.open({ tabId });
  } else {
    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  }
  
  return {
    success: true,
  };
}

/**
 * Update extension badge
 */
async function handleUpdateBadge(payload: { text: string; color: string; tabId?: number }): Promise<MessageResponse> {
  const { text, color, tabId } = payload;
  
  if (tabId) {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color, tabId });
  } else {
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color });
  }
  
  return {
    success: true,
  };
}

/**
 * Clear current session
 */
async function handleClearSession(): Promise<MessageResponse> {
  await flashStorage.remove('currentSession');
  await flashStorage.remove('formCache');
  await flashStorage.remove('answersCache');
  
  return {
    success: true,
  };
}

/**
 * Initialize default storage values
 */
async function initializeDefaultStorage(): Promise<void> {
  // Set default preferences
  await flashSyncStorage.set('preferences', {
    autoAnalyze: false,
    autoOpenSidepanel: false,
    autoFill: false,
    minConfidence: 0.5,
    highlightFilled: true,
    enableNotifications: true,
    theme: 'auto',
  });

  // Set default API settings
  await flashSyncStorage.set('apiSettings', {
    baseURL: process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:8000',
    apiKey: '',
    timeout: 30000,
    connected: false,
  });

  console.log('[Flash Background] Default storage initialized');
}

/**
 * Check if URL is a job board
 */
async function checkIfJobBoard(url: string): Promise<boolean> {
  const jobBoardDomains = [
    'linkedin.com/jobs',
    'greenhouse.io',
    'lever.co',
    'workday.com',
    'indeed.com',
    'glassdoor.com',
    'monster.com',
    'careerbuilder.com',
    'ziprecruiter.com',
    'simplyhired.com',
  ];

  return jobBoardDomains.some((domain) => url.includes(domain));
}

/**
 * Inject content script into tab if not already injected
 */
async function injectContentScriptIfNeeded(tabId: number): Promise<void> {
  try {
    // Check if content script is already injected
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response) {
      console.log('[Flash Background] Content script already injected');
      return;
    }
  } catch {
    // Content script not injected, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      console.log('[Flash Background] Content script injected');
    } catch (error) {
      console.error('[Flash Background] Failed to inject content script:', error);
    }
  }
}

/**
 * Setup context menus
 */
function setupContextMenus(): void {
  // Check if contextMenus API is available
  if (!chrome.contextMenus) {
    console.warn('[Flash Background] contextMenus API not available');
    return;
  }

  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'flash-analyze-job',
        title: 'Analyze this job posting',
        contexts: ['page', 'selection'],
      });

      chrome.contextMenus.create({
        id: 'flash-fill-form',
        title: 'Fill application form',
        contexts: ['page'],
      });

      chrome.contextMenus.create({
        id: 'flash-open-sidepanel',
        title: 'Open Flash Assistant',
        contexts: ['page'],
      });
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      if (!tab?.id) return;

      switch (info.menuItemId) {
        case 'flash-analyze-job':
          // Send message to content script to analyze job
          chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_JOB' });
          break;

        case 'flash-fill-form':
          // Send message to content script to fill form
          chrome.tabs.sendMessage(tab.id, { type: 'FILL_APPLICATION' });
          break;

        case 'flash-open-sidepanel':
          // Open side panel
          chrome.sidePanel.open({ tabId: tab.id });
          break;
      }
    });
  } catch (error) {
    console.error('[Flash Background] Error setting up context menus:', error);
  }
}

// Keep service worker alive (optional, for development)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('[Flash Background] Keepalive ping');
  }, 20000);
}
