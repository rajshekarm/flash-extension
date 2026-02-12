// Message handler for checking authentication status
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  console.log('[checkAuth] Checking authentication status');

  try {
    // Get stored auth session
    const authSession = await flashStorage.get('authSession');
    const authToken = await flashStorage.get('authToken');
    
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
          // Try to refresh the token
          const refreshResponse = await flashAPI.refreshToken({ refresh_token: refreshToken });
          
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
      const user = await flashAPI.getCurrentUser();
      
      console.log('[checkAuth] Server validation successful:', user.id);
      
      res.send({
        success: true,
        authenticated: true,
        data: user,
      });
    } catch (serverError) {
      console.warn('[checkAuth] Server validation failed:', serverError);
      
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