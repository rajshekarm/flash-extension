// Message handler for checking authentication status
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashStorage } from '~lib/storage/chrome';

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  console.log('[checkAuth] Checking authentication status...');

  try {
    // DEBUG: Check raw Chrome storage
    const rawStorage = await chrome.storage.local.get(['authSession', 'authToken', 'refreshToken']);
    console.log('[checkAuth] RAW Chrome Storage:', rawStorage);
    
    // Get stored auth session and token
    const authSession = await flashStorage.get('authSession');
    const authToken = await flashStorage.get('authToken');
    
    console.log('[checkAuth] FlashStorage.get() results:', { 
      hasSession: !!authSession, 
      hasToken: !!authToken,
      expiresAt: authSession?.expires_at,
      hasUser: !!authSession?.user,
      userId: authSession?.user?.id
    });
    
    if (!authSession || !authToken) {
      console.log('[checkAuth] No auth session found');
      res.send({
        success: true,
        authenticated: false,
        data: null,
      });
      return;
    }

    // Simple expiration check
    const expiresAt = new Date(authSession.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      console.log('[checkAuth] Token expired');
      
      // Clear expired session
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

    // Session is valid
    console.log('[checkAuth] Session is valid for user:', authSession.user?.id);
    
    res.send({
      success: true,
      authenticated: true,
      data: authSession.user,
    });
    
  } catch (error) {
    console.error('[checkAuth] Error:', error);
    
    res.send({
      success: false,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Auth check failed',
    });
  }
};

export default handler;