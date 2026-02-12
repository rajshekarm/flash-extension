// Message handler for checking authentication status
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

// Helper function to timeout promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
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
  console.log('[checkAuth] Checking authentication status');

  try {
    // Get stored auth session
    const authSession = await flashStorage.get('authSession');
    const authToken = await flashStorage.get('authToken');
    
    console.log('[checkAuth] Auth data retrieved:', { hasSession: !!authSession, hasToken: !!authToken });
    
    if (!authSession || !authToken) {
      console.log('[checkAuth] No stored session found');
      res.send({
        success: true,
        authenticated: false,
        data: null,
      });
      return;
    }

    // Check if token is expired
    const expiresAt = new Date(authSession.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      console.log('[checkAuth] Token expired, checking refresh token');
      
      const refreshToken = await flashStorage.get('refreshToken');
      if (refreshToken) {
        try {
          console.log('[checkAuth] Attempting token refresh...');
          // Try to refresh the token with 10-second timeout
          const refreshResponse = await withTimeout(
            flashAPI.refreshToken({ refresh_token: refreshToken }),
            10000
          );
          
          // Update stored tokens
          await flashStorage.set('authToken', refreshResponse.access_token);
          const updatedSession = {
            ...authSession,
            access_token: refreshResponse.access_token,
            expires_at: refreshResponse.expires_at,
          };
          await flashStorage.set('authSession', updatedSession);
          
          console.log('[checkAuth] Token refreshed successfully');
          
          res.send({
            success: true,
            authenticated: true,
            data: authSession.user,
          });
          return;
        } catch (refreshError) {
          console.warn('[checkAuth] Token refresh failed:', refreshError);
          
          // Check if it's a network timeout or connection error
          const isNetworkError = refreshError instanceof Error && 
            (refreshError.message.includes('timeout') || 
             refreshError.message.includes('Network Error') ||
             refreshError.message.includes('ERR_'));
          
          if (isNetworkError) {
            console.log('[checkAuth] Network error during refresh, keeping expired session temporarily');
            res.send({
              success: true,
              authenticated: true,
              data: authSession.user,
              warning: 'Backend unavailable, session may be expired',
            });
            return;
          }
          
          // Clear invalid session
          await Promise.all([
            flashStorage.remove('authSession'),
            flashStorage.remove('authToken'),
            flashStorage.remove('refreshToken'),
          ]);
          
          res.send({
            success: true,
            authenticated: false,
            data: null,
          });
          return;
        }
      } else {
        // No refresh token, session is invalid
        await Promise.all([
          flashStorage.remove('authSession'),
          flashStorage.remove('authToken'),
        ]);
        
        res.send({
          success: true,
          authenticated: false,
          data: null,
        });
        return;
      }
    }

    // Token is still valid, verify with server
    try {
      console.log('[checkAuth] Validating token with server...');
      const user = await withTimeout(
        flashAPI.getCurrentUser(),
        10000
      );
      
      console.log('[checkAuth] Server validation successful:', user.id);
      
      res.send({
        success: true,
        authenticated: true,
        data: user,
      });
    } catch (serverError) {
      console.warn('[checkAuth] Server validation failed:', serverError);
      
      // If it's a timeout or network error and token isn't expired, keep session
      const isNetworkError = serverError instanceof Error && 
        (serverError.message.includes('timeout') || 
         serverError.message.includes('Network Error') ||
         serverError.message.includes('ERR_'));
      
      if (isNetworkError) {
        console.log('[checkAuth] Network error detected, keeping local session');
        res.send({
          success: true,
          authenticated: true,
          data: authSession.user,
          warning: 'Backend unavailable, using cached session',
        });
        return;
      }
      
      // Server says token is invalid, clear local session
      await Promise.all([
        flashStorage.remove('authSession'),
        flashStorage.remove('authToken'),
        flashStorage.remove('refreshToken'),
      ]);
      
      res.send({
        success: true,
        authenticated: false,
        data: null,
      });
    }
  } catch (error) {
    console.error('[checkAuth] Error:', error);
    
    const authError = parseUserProfileError(error);
    
    res.send({
      success: false,
      authenticated: false,
      error: authError.message,
      errorType: authError.type,
    });
  }
};

export default handler;