// Message handler for user login
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';

interface LoginRequest {
  email: string;
  password: string;
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[login] Starting login...');

  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      res.send({ success: false, error: 'Email and password are required' });
      return;
    }

    console.log('[login] Calling backend API...');
    const authSession = await flashAPI.login({ email, password });
    
    console.log('[login] Backend response received');

    // Store authentication data
    await flashStorage.set('authSession', authSession);
    await flashStorage.set('authToken', authSession.access_token);
    
    if (authSession.refresh_token) {
      await flashStorage.set('refreshToken', authSession.refresh_token);
    }

    console.log('[login] Login successful');
    res.send({ success: true, data: authSession });

  } catch (error) {
    console.error('[login] Login failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    
    // Simple error classification
    if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
      res.send({ 
        success: false, 
        error: 'Invalid email or password' 
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