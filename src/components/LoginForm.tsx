// Login form component
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { login } from '~lib/storage/chrome';

interface LoginFormProps {
  onLoginSuccess: (authSession: any) => void;
  onShowRegister: () => void;
}

export function LoginForm({ onLoginSuccess, onShowRegister }: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const authSession = await login(formData.email, formData.password);
      onLoginSuccess(authSession);
    } catch (error) {
      console.error('[LoginForm] Login failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      // Simple error handling
      if (errorMessage.toLowerCase().includes('invalid') || 
          errorMessage.includes('401') ||
          errorMessage.toLowerCase().includes('unauthorized')) {
        setError('Invalid email or password');
      } else if (errorMessage.toLowerCase().includes('network') || 
                 errorMessage.toLowerCase().includes('connection')) {
        setError('Cannot connect to server. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

      return (
    <Card>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          🔥 Welcome Back
        </h2>
        <p className="text-sm text-gray-600">
          Sign in to your Flash account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="Enter your email"
          required
        />
        
        <Input
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Enter your password"
          required
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          variant="primary"
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onShowRegister}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Create one
            </button>
          </p>
        </div>
      </form>
    </Card>
  );
}