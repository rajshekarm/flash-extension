// Message handler for user logout
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  console.log('[logout] Received request');

  try {
    // Get current auth session
    const authSession = await flashStorage.get('authSession');
    
    if (authSession) {
      try {
        // Call Flash API to logout (invalidate token on server)
        await flashAPI.logout();
        console.log('[logout] Server logout successful');
      } catch (error) {
        console.warn('[logout] Server logout failed, clearing local session anyway:', error);
        // Continue with local cleanup even if server logout fails
      }
    }

    // Clear all authentication data locally
    await Promise.all([
      flashStorage.remove('authSession'),
      flashStorage.remove('authToken'),
      flashStorage.remove('refreshToken'),
      flashStorage.remove('userProfile'), // Clear cached profile
      flashStorage.remove('currentSession'), // Clear current session
    ]);

    console.log('[logout] Local session cleared');

    res.send({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[logout] Error:', error);
    
    const authError = parseUserProfileError(error);
    
    res.send({
      success: false,
      error: authError.message,
      errorType: authError.type,
    });
  }
};

export default handler;