// Message handler for user login
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';
import type { LoginCredentials } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[login] Received request');

  try {
    const { email, password } = req.body as LoginCredentials;

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log('[login] Calling Flash API...', { email });

    // Call Flash API to login
    const authSession = await flashAPI.login({ email, password });

    // Store authentication session and tokens
    await flashStorage.set('authSession', authSession);
    await flashStorage.set('authToken', authSession.access_token);
    if (authSession.refresh_token) {
      await flashStorage.set('refreshToken', authSession.refresh_token);
    }

    console.log('[login] Login successful:', authSession.user.id);

    res.send({
      success: true,
      data: authSession,
    });
  } catch (error) {
    console.error('[login] Error:', error);
    
    const authError = parseUserProfileError(error);
    
    res.send({
      success: false,
      error: authError.message,
      errorType: authError.type,
    });
  }
};

export default handler;