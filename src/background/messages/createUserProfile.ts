// Message handler for creating user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';
import type { UserProfile } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[createUserProfile] Received request', req.body);

  try {
    const { profile } = req.body as {
      profile: UserProfile;
    };

    if (!profile) {
      throw new Error('User profile data is required');
    }

    if (!profile.name || !profile.email) {
      throw new Error('Name and email are required fields');
    }

    console.log('[createUserProfile] Calling Flash API...', {
      name: profile.name,
      email: profile.email,
    });

    // Call Flash API to create user profile
    const createdProfile = await flashAPI.createUserProfile(profile);

    // Store in sync storage as fallback/cache
    await flashSyncStorage.set('userProfile', createdProfile);

    console.log('[createUserProfile] Profile created:', createdProfile.id);

    res.send({
      success: true,
      data: createdProfile,
    });
  } catch (error) {
    console.error('[createUserProfile] Error:', error);
    
    const profileError = parseUserProfileError(error);
    
    res.send({
      success: false,
      error: profileError.message,
      errorType: profileError.type,
    });
  }
};

export default handler;