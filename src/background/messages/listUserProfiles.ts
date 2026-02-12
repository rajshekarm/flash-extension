// Message handler for listing user profiles
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

const handler: PlasmoMessaging.MessageHandler = async (_req, res) => {
  console.log('[listUserProfiles] Received request');

  try {
    console.log('[listUserProfiles] Calling Flash API...');

    try {
      // Try to get from backend first
      const profiles = await flashAPI.listUserProfiles();
      
      console.log('[listUserProfiles] Profiles fetched from backend:', profiles.length);
      
      res.send({
        success: true,
        data: profiles,
      });
    } catch (backendError) {
      console.warn('[listUserProfiles] Backend failed, using local cache:', backendError);
      
      // Fallback to local storage if backend is unavailable
      const cachedProfile = await flashSyncStorage.get('userProfile');
      
      const profileError = parseUserProfileError(backendError);
      
      if (cachedProfile) {
        console.log('[listUserProfiles] Using cached profile:', cachedProfile.id);
        
        res.send({
          success: true,
          data: [cachedProfile],
          source: 'cache',
          warning: profileError.type === 'NETWORK' ? 
            'Showing cached profiles only. Connect to backend for full list.' :
            `Backend unavailable: ${profileError.message}`,
        });
      } else {
        res.send({
          success: true,
          data: [],
          source: 'cache',
          warning: 'No cached profiles found. Connect to backend to see your profiles.',
        });
      }
    }
  } catch (error) {
    console.error('[listUserProfiles] Error:', error);
    
    const profileError = parseUserProfileError(error);

    res.send({
      success: false,
      error: profileError.message,
      errorType: profileError.type,
    });
  }
};

export default handler;