// Message handler for updating user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage, flashStorage } from '~lib/storage/chrome';
import { apiClient } from '~lib/api/client';

interface UpdateProfileRequest {
  userId: string;
  profile: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    skills: string[];
    experience?: any[];
    education?: any[];
  };
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[updateUserProfile] Starting profile update...');

  try {
    const { userId, profile } = req.body as UpdateProfileRequest;

    if (!userId || !profile || !profile.name || !profile.email) {
      res.send({ success: false, error: 'User ID, name and email are required' });
      return;
    }

    // Make sure API client has auth token
    const authToken = await flashStorage.get('authToken');
    if (authToken) {
      console.log('[updateUserProfile] Setting auth token in API client');
      await apiClient.setAuthToken(authToken);
    } else {
      console.log('[updateUserProfile] No auth token found');
      res.send({ success: false, error: 'Authentication required' });
      return;
    }

    console.log('[updateUserProfile] Calling backend API...');
    const updatedProfile = await flashAPI.updateUserProfile(userId, profile);

    // Store in sync storage as backup
    await flashSyncStorage.set('userProfile', updatedProfile);

    console.log('[updateUserProfile] Profile updated successfully');
    res.send({ success: true, data: updatedProfile });

  } catch (error) {
    console.error('[updateUserProfile] Failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
    
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      res.send({ success: false, error: 'Authentication required' });
    } else {
      res.send({ success: false, error: errorMessage });
    }
  }
};

export default handler;