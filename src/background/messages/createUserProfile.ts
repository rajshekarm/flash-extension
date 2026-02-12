// Message handler for creating user profile
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashSyncStorage, flashStorage } from '~lib/storage/chrome';
import { apiClient } from '~lib/api/client';

interface CreateProfileRequest {
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
  console.log('[createUserProfile] Starting profile creation...');

  try {
    const { profile } = req.body as CreateProfileRequest;

    if (!profile || !profile.name || !profile.email) {
      res.send({ success: false, error: 'Name and email are required' });    
      return;
    }

    // Make sure API client has auth token
    const authToken = await flashStorage.get('authToken');
    console.log('[createUserProfile] Retrieved authToken:', {
      hasToken: !!authToken,
      tokenType: typeof authToken,
      tokenLength: authToken ? authToken.length : 0,
      tokenPrefix: authToken ? authToken.substring(0, 20) + '...' : 'null',
      tokenValue: authToken // Full token for debugging
    });
    
    if (authToken) {
      console.log('[createUserProfile] Setting auth token in API client');
      await apiClient.setAuthToken(authToken);
      
      // Verify it was set
      const settings = await apiClient.getSettings();
      console.log('[createUserProfile] API client settings after setAuthToken:', {
        hasAuthToken: !!settings.authToken,
        tokenMatches: settings.authToken === authToken
      });
    } else {
      console.log('[createUserProfile] No auth token found');
      res.send({ success: false, error: 'Authentication required' });
      return;
    }

    console.log('[createUserProfile] Calling backend API...');
    const createdProfile = await flashAPI.createUserProfile(profile);

    // Store in sync storage as backup
    await flashSyncStorage.set('userProfile', createdProfile);

    console.log('[createUserProfile] Profile created successfully');
    res.send({ success: true, data: createdProfile });

  } catch (error) {
    console.error('[createUserProfile] Failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Profile creation failed';
    
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      res.send({ success: false, error: 'Authentication required' });
    } else {
      res.send({ success: false, error: errorMessage });
    }
  }
};

export default handler;