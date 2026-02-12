// Authentication guard component
import { useState, useEffect, ReactNode } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Spinner } from './Spinner';
import { checkAuth, logout } from '~lib/storage/chrome';
import type { AuthUser } from '~types';

interface AuthGuardProps {
  children: ReactNode;
}

type AuthMode = 'login' | 'register';

export function AuthGuard({ children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const authResult = await checkAuth();
      setIsAuthenticated(authResult.authenticated);
      setUser(authResult.user);
    } catch (error) {
      console.error('[AuthGuard] Auth check failed:', error);
      setError('Failed to verify authentication status');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (authSession: any) => {
    setIsAuthenticated(true);
    setUser(authSession.user);
    setError('');
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('[AuthGuard] Logout failed:', error);
      // Still clear local state even if logout request fails
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Spinner size="large" />
          <p className="mt-2 text-sm text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={checkAuthStatus}
            className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4">
        {authMode === 'login' ? (
          <LoginForm
            onLoginSuccess={handleAuthSuccess}
            onShowRegister={() => setAuthMode('register')}
          />
        ) : (
          <RegisterForm
            onRegisterSuccess={handleAuthSuccess}
            onShowLogin={() => setAuthMode('login')}
          />
        )}
      </div>
    );
  }

  // User is authenticated, show the protected content with logout option
  return (
    <div>
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900">Welcome, {user?.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
          >
            Logout
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}