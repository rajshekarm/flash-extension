// Message handler for deleting user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[deleteUserProfile] Received request', req.body);

  try {
    const { userId } = req.body as {
      userId: string;
    };

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('[deleteUserProfile] Calling Flash API...', { userId });

    try {
      // Try to delete from backend first
      await flashAPI.deleteUserProfile(userId);
      
      // Remove from local cache
      const cachedProfile = await flashSyncStorage.get('userProfile');
      if (cachedProfile && cachedProfile.id === userId) {
        await flashSyncStorage.remove('userProfile');
      }
      
      console.log('[deleteUserProfile] Profile deleted from backend:', userId);
      
      res.send({
        success: true,
        data: { userId, deleted: true },
      });
    } catch (backendError) {
      console.warn('[deleteUserProfile] Backend failed, removing from local cache only:', backendError);
      
      // If backend fails, remove from local cache only
      const cachedProfile = await flashSyncStorage.get('userProfile');
      if (cachedProfile && cachedProfile.id === userId) {
        await flashSyncStorage.remove('userProfile');
        
        const profileError = parseUserProfileError(backendError);
        
        res.send({
          success: true,
          data: { userId, deleted: true },
          source: 'cache',
          warning: profileError.type === 'NETWORK' ?
            'Profile removed locally. Will sync deletion when backend is available.' :
            `Profile removed locally: ${profileError.message}`,
        });
      } else {
        throw new Error('User profile not found locally');
      }
    }
  } catch (error) {
    console.error('[deleteUserProfile] Error:', error);
    
    const profileError = parseUserProfileError(error);

    res.send({
      success: false,
      error: profileError.message,
      errorType: profileError.type,
    });
  }
};

export default handler;