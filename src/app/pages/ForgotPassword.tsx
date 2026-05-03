import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { apiService } from '../services/api';
import { AlertCircle, Lock } from 'lucide-react';

interface SecurityQuestions {
  question1: string;
  question2: string;
  customQuestion: string;
}

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'questions' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<SecurityQuestions | null>(null);
  const [answers, setAnswers] = useState({
    answer1: '',
    answer2: '',
    customAnswer: ''
  });
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleGetQuestions = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.getSecurityQuestions(email.trim());
      setQuestions(response);
      setStep('questions');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'User not found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAnswers = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!answers.answer1.trim() || !answers.answer2.trim() || !answers.customAnswer.trim()) {
      toast.error('Please answer all questions');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.validateSecurityAnswers({
        email: email.trim(),
        answers: {
          answer1: answers.answer1.trim(),
          answer2: answers.answer2.trim(),
          customAnswer: answers.customAnswer.trim()
        }
      });

      setResetToken(response.resetToken);
      setStep('reset');
      toast.success('Security questions verified!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Incorrect answers');
      // Reset answers
      setAnswers({ answer1: '', answer2: '', customAnswer: '' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
    if (!strongPasswordRegex.test(newPassword)) {
      toast.error('Password must include uppercase, lowercase, number, and special character');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.resetPassword({
        resetToken,
        newPassword
      });

      toast.success('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">FlowBoard</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset your password</h2>
          <p className="text-gray-600">Answer your security questions to regain access</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleGetQuestions} className="space-y-5">
              <div>
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="mt-2"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Looking up account...' : 'Continue'}
              </Button>
            </form>
          )}

          {/* Step 2: Security Questions */}
          {step === 'questions' && questions && (
            <form onSubmit={handleValidateAnswers} className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Answer your security questions to proceed. You have 3 attempts.
                </p>
              </div>

              <div>
                <Label className="block mb-2 font-medium">{questions.question1}</Label>
                <Input
                  type="text"
                  placeholder="Your answer..."
                  value={answers.answer1}
                  onChange={(e) => setAnswers({ ...answers, answer1: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label className="block mb-2 font-medium">{questions.question2}</Label>
                <Input
                  type="text"
                  placeholder="Your answer..."
                  value={answers.answer2}
                  onChange={(e) => setAnswers({ ...answers, answer2: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label className="block mb-2 font-medium">{questions.customQuestion}</Label>
                <Input
                  type="text"
                  placeholder="Your answer..."
                  value={answers.customAnswer}
                  onChange={(e) => setAnswers({ ...answers, customAnswer: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep('email');
                    setEmail('');
                    setQuestions(null);
                  }}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify Answers'}
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Reset Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 mb-6">
                <Lock className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Great! Now set a new password for your account.
                </p>
              </div>

              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  At least 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="mt-2"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Resetting password...' : 'Reset Password'}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Having trouble? Contact our support team
        </p>
      </div>
    </div>
  );
}
