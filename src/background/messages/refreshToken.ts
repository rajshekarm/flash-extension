// Message handler for refreshing authentication token
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

// Helper function to timeout promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Token refresh timed out after ${timeoutMs}ms - check if backend is running`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  console.log('[refreshToken] Received request');

  try {
    // Get stored refresh token
    const refreshToken = await flashStorage.get('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('[refreshToken] Calling Flash API...');

    // Call Flash API to refresh token
    console.log('[refreshToken] Refreshing token with backend...');
    const refreshResponse = await withTimeout(
      flashAPI.refreshToken({ refresh_token: refreshToken }),
      10000 // 10 second timeout for token refresh
    );

    // Update stored tokens
    await flashStorage.set('authToken', refreshResponse.access_token);
    
    const authSession = await flashStorage.get('authSession');
    if (authSession) {
      const updatedSession = {
        ...authSession,
        access_token: refreshResponse.access_token,
        expires_at: refreshResponse.expires_at,
      };
      await flashStorage.set('authSession', updatedSession);
    }

    console.log('[refreshToken] Token refresh successful');

    res.send({
      success: true,
      data: {
        access_token: refreshResponse.access_token,
        expires_at: refreshResponse.expires_at,
      },
    });
  } catch (error) {
    console.error('[refreshToken] Error:', error);
    
    // If refresh fails, clear all auth data
    await Promise.all([
      flashStorage.remove('authSession'),
      flashStorage.remove('authToken'),
      flashStorage.remove('refreshToken'),
    ]);
    
    const authError = parseUserProfileError(error);
    
    res.send({
      success: false,
      error: authError.message,
      errorType: authError.type,
    });
  }
};

export default handler;