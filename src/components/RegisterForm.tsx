// Registration form component
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { 
  getUserFriendlyErrorMessage, 
  getErrorActionSuggestions,
  parseUserProfileError 
} from '~lib/utils/userProfileErrors';
import { register } from '~lib/storage/chrome';

interface RegisterFormProps {
  onRegisterSuccess: (authSession: any) => void;
  onShowLogin: () => void;
}

export function RegisterForm({ onRegisterSuccess, onShowLogin }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const authSession = await register(
        formData.name, 
        formData.email, 
        formData.password, 
        formData.confirmPassword
      );
      onRegisterSuccess(authSession);
    } catch (error) {
      console.error('[RegisterForm] Registration error:', error);
      
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
          🔥 Join Flash
        </h2>
        <p className="text-sm text-gray-600">
          Create your account to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter your full name"
          required
          autoComplete="name"
        />
        
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
          placeholder="Create a password (6+ characters)"
          required
          autoComplete="new-password"
        />
        
        <Input
          label="Confirm Password"
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
          placeholder="Confirm your password"
          required
          autoComplete="new-password"
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
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onShowLogin}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </Card>
  );
}