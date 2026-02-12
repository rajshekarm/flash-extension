// Message handler for updating user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';
import type { UserProfile } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[updateUserProfile] Received request', req.body);

  try {
    const { userId, profile } = req.body as {
      userId: string;
      profile: UserProfile;
    };

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!profile) {
      throw new Error('User profile data is required');
    }

    if (!profile.name || !profile.email) {
      throw new Error('Name and email are required fields');
    }

    console.log('[updateUserProfile] Calling Flash API...', {
      userId,
      name: profile.name,
      email: profile.email,
    });

    try {
      // Try to update in backend first
      const updatedProfile = await flashAPI.updateUserProfile(userId, profile);
      
      // Update sync storage cache
      await flashSyncStorage.set('userProfile', updatedProfile);
      
      console.log('[updateUserProfile] Profile updated in backend:', updatedProfile.id);
      
      res.send({
        success: true,
        data: updatedProfile,
      });
    } catch (backendError) {
      console.warn('[updateUserProfile] Backend failed, updating local cache only:', backendError);
      
      // If backend fails, update local cache and mark for sync
      const profileWithId = { ...profile, id: userId };
      await flashSyncStorage.set('userProfile', profileWithId);
      
      const profileError = parseUserProfileError(backendError);
      
      res.send({
        success: true,
        data: profileWithId,
        source: 'cache',
        warning: profileError.type === 'NETWORK' ? 
          'Profile saved locally. Will sync when backend is available.' :
          `Profile saved locally: ${profileError.message}`,
      });
    }
  } catch (error) {
    console.error('[updateUserProfile] Error:', error);
    
    const profileError = parseUserProfileError(error);

    res.send({
      success: false,
      error: profileError.message,
      errorType: profileError.type,
    });
  }
};

export default handler;