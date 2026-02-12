// Message handler for deleting user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';
// Helper function to timeout promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Profile deletion timed out after ${timeoutMs}ms - check if backend is running`));
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
      console.log('[deleteUserProfile] Deleting profile from backend...');
      await withTimeout(
        flashAPI.deleteUserProfile(userId),
        10000 // 10 second timeout for profile deletion
      );
      
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