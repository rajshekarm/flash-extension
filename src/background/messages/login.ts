// Message handler for user login
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

// Helper function to timeout promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Login timed out after ${timeoutMs}ms - check if backend is running`));
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
    console.log('[login] Attempting login with backend...');
    const authSession = await withTimeout(
      flashAPI.login({ email, password }),
      15000 // 15 second timeout for login
    );

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