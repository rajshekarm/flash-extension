// Message handler for user registration
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import { parseUserProfileError } from '~lib/utils/userProfileErrors';

// Helper function to timeout promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Registration timed out after ${timeoutMs}ms - check if backend is running`));
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
import type { RegisterCredentials } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[register] Received request');

  try {
    const { name, email, password, confirmPassword } = req.body as RegisterCredentials;

    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    console.log('[register] Calling Flash API...', { name, email });

    // Call Flash API to register
    console.log('[register] Attempting registration with backend...');
    const authSession = await withTimeout(
      flashAPI.register({ name, email, password }),
      15000 // 15 second timeout for registration
    );

    // Store authentication session and tokens
    await flashStorage.set('authSession', authSession);
    await flashStorage.set('authToken', authSession.access_token);
    if (authSession.refresh_token) {
      await flashStorage.set('refreshToken', authSession.refresh_token);
    }

    console.log('[register] Registration successful:', authSession.user.id);

    res.send({
      success: true,
      data: authSession,
    });
  } catch (error) {
    console.error('[register] Error:', error);
    
    const authError = parseUserProfileError(error);
    
    res.send({
      success: false,
      error: authError.message,
      errorType: authError.type,
    });
  }
};

export default handler;