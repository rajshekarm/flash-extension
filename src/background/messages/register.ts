// Message handler for user registration
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[register] Starting registration...');

  try {
    const { name, email, password, confirmPassword } = req.body as RegisterRequest;

    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      res.send({ success: false, error: 'All fields are required' });
      return;
    }

    if (password !== confirmPassword) {
      res.send({ success: false, error: 'Passwords do not match' });
      return;
    }

    if (password.length < 6) {
      res.send({ success: false, error: 'Password must be at least 6 characters long' });
      return;
    }

    console.log('[register] Calling backend API...');
    const authSession = await flashAPI.register({ name, email, password });
    
    console.log('[register] Backend response received');

    // Store authentication data
    await flashStorage.set('authSession', authSession);
    await flashStorage.set('authToken', authSession.access_token);
    
    if (authSession.refresh_token) {
      await flashStorage.set('refreshToken', authSession.refresh_token);
    }

    // DEBUG: Verify what was stored
    const verifySession = await flashStorage.get('authSession');
    const verifyToken = await flashStorage.get('authToken');
    console.log('[register] Stored auth data verification:', {
      sessionStored: !!verifySession,
      tokenStored: !!verifyToken,
      hasUser: !!verifySession?.user,
      userId: verifySession?.user?.id
    });
    
    // DEBUG: Check raw Chrome storage
    const rawStorage = await chrome.storage.local.get(['authSession', 'authToken', 'refreshToken']);
    console.log('[register] RAW Chrome Storage after storing:', rawStorage);

    console.log('[register] Registration successful');
    res.send({ success: true, data: authSession });

  } catch (error) {
    console.error('[register] Registration failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    
    // Simple error classification
    if (errorMessage.toLowerCase().includes('already registered') || 
        errorMessage.toLowerCase().includes('already exists')) {
      res.send({ 
        success: false, 
        error: 'Email already registered'
      });
    } else if (errorMessage.toLowerCase().includes('network') ||
               errorMessage.toLowerCase().includes('connection')) {
      res.send({ 
        success: false, 
        error: 'Network error - check connection' 
      });
    } else {
      res.send({ 
        success: false, 
        error: errorMessage 
      });
    }
  }
};

export default handler;