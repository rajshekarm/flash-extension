// Message handler for getting user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[getUserProfile] Received request', req.body);

  try {
    const { userId } = req.body as {
      userId: string;
    };

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('[getUserProfile] Calling Flash API...', { userId });

    try {
      // Try to get from backend first
      const profile = await flashAPI.getUserProfile(userId);
      
      // Cache in sync storage
      await flashSyncStorage.set('userProfile', profile);
      
      console.log('[getUserProfile] Profile fetched from backend:', profile);
      
      res.send({
        success: true,
        data: profile,
      });
    } catch (backendError) {
      console.warn('[getUserProfile] Backend failed, trying local cache:', backendError);
      
      // Fallback to local storage if backend is unavailable
      const cachedProfile = await flashSyncStorage.get('userProfile');
      
      if (cachedProfile && cachedProfile.id === userId) {
        console.log('[getUserProfile] Using cached profile:', cachedProfile.id);
        
        res.send({
          success: true,
          data: cachedProfile,
          source: 'cache',
        });
      } else {
        throw backendError;
      }
    }
  } catch (error) {
    console.error('[getUserProfile] Error:', error);
    
    const profileError = parseUserProfileError(error);

    res.send({
      success: false,
      error: profileError.message,
      errorType: profileError.type,
    });
  }
};

export default handler;