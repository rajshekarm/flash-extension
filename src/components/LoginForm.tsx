// Login form component
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { 
  getUserFriendlyErrorMessage, 
  getErrorActionSuggestions,
  parseUserProfileError 
} from '~lib/utils/userProfileErrors';
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
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const authSession = await login(formData.email, formData.password);
      onLoginSuccess(authSession);
    } catch (error) {
      console.error('[LoginForm] Login error:', error);
      
      const authError = parseUserProfileError(error);
      const friendlyMessage = getUserFriendlyErrorMessage(authError);
      const suggestions = getErrorActionSuggestions(authError);
      
      setError(`${friendlyMessage}\n\nSuggestions:\n• ${suggestions.join('\n• ')}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          🔥 Welcome to Flash
        </h2>
        <p className="text-sm text-gray-600">
          Sign in to your account to continue
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
          autoComplete="email"
        />
        
        <Input
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Enter your password"
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
          </div>
        )}

        <Button
          variant="primary"
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onShowRegister}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign up
            </button>
          </p>
        </div>
      </form>
    </Card>
  );
}