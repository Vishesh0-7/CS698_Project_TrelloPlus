import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { apiService } from '../services/api';
import { Lock, AlertCircle } from 'lucide-react';

interface SecurityQuestionsSetupProps {
  userId?: string;
  onComplete: () => void;
  onSkip?: () => void;
  displayMode?: 'standalone' | 'embedded';
  initialQuestions?: {
    question1: string;
    question2: string;
    customQuestion: string;
  } | null;
  requireCurrentPassword?: boolean;
}

const SYSTEM_QUESTIONS = [
  "Name a teacher or mentor who inspired you",
  "What's the name of your favorite book character?",
  "First place you traveled outside your home country?",
  "Name a company you've always wanted to work for",
  "What's a skill you wish you had?",
  "Name a movie that made you cry or deeply moved you",
  "What's the name of your childhood best friend?",
  "Name a book that changed your perspective",
  "What was your first job?",
  "Name a person who changed your life",
  "What's your favorite sport to play or watch?",
  "Name a place that makes you feel at peace"
];

export function SecurityQuestionsSetup(props: SecurityQuestionsSetupProps) {
  const { onComplete, onSkip, displayMode = 'standalone', initialQuestions, requireCurrentPassword = false } = props;
  const [step, setStep] = useState<'intro' | 'setup'>(initialQuestions ? 'setup' : 'intro');
  const [currentPassword, setCurrentPassword] = useState('');
  const [selectedQ1, setSelectedQ1] = useState(initialQuestions?.question1 || '');
  const [selectedQ2, setSelectedQ2] = useState(initialQuestions?.question2 || '');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [customQuestion, setCustomQuestion] = useState(initialQuestions?.customQuestion || '');
  const [customAnswer, setCustomAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requireCurrentPassword && !currentPassword.trim()) {
      toast.error('Please enter your current password');
      return;
    }

    if (!selectedQ1 || !selectedQ2 || !answer1.trim() || !answer2.trim() || !customQuestion.trim() || !customAnswer.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (selectedQ1 === selectedQ2) {
      toast.error('Please select different system questions');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.setSecurityQuestions({
        ...(requireCurrentPassword && { currentPassword: currentPassword.trim() }),
        securityQuestion1: selectedQ1,
        securityAnswer1: answer1.trim(),
        securityQuestion2: selectedQ2,
        securityAnswer2: answer2.trim(),
        customSecurityQuestion: customQuestion.trim(),
        customSecurityAnswer: customAnswer.trim(),
      });

      toast.success('Security questions saved successfully!');
      onComplete();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save security questions');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'intro') {
    const introCard = (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
            <Lock className="w-7 h-7 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">Secure Your Account</h2>
        <p className="text-gray-600 text-center mb-6">
          Set up security questions to help recover your account if you forget your password.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Why this matters</p>
            <p className="text-sm text-blue-800 mt-1">
              These questions help us verify your identity if you ever need to reset your password.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => setStep('setup')}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            Set Up Security Questions
          </Button>
          {onSkip && (
            <Button
              onClick={onSkip}
              variant="outline"
              className="w-full"
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>
    );

    if (displayMode === 'embedded') {
      return introCard;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="w-full max-w-md">
          {introCard}

          <p className="text-center text-xs text-gray-500 mt-6">
            You can update these questions later in your account settings
          </p>
        </div>
      </div>
    );
  }

  const setupForm = (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Security Questions Setup</h2>
      <p className="text-gray-600 mb-8">
        Choose 2 system questions below, and create 1 custom security question. Your answers will be encrypted and used for account recovery.
      </p>

      <form onSubmit={handleSetup} className="space-y-8">
        {requireCurrentPassword && (
          <div>
            <Label htmlFor="security-current-password" className="block mb-3 font-semibold text-gray-900">
              Current Password <span className="text-red-500">*</span>
            </Label>
            <Input
              id="security-current-password"
              type="password"
              placeholder="Enter your current password..."
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        {/* System Question 1 */}
        <div>
          <Label htmlFor="system-q1" className="block mb-3 font-semibold text-gray-900">
            System Question 1 <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-gray-500 mb-2">Answers are case-insensitive and special characters are removed.</p>
          <select
            id="system-q1"
            value={selectedQ1}
            onChange={(e) => setSelectedQ1(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="">Select a question...</option>
            {SYSTEM_QUESTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <Input
            type="text"
            placeholder="Your answer..."
            value={answer1}
            onChange={(e) => setAnswer1(e.target.value)}
            disabled={isLoading || !selectedQ1}
            maxLength={500}
            className="mt-2"
          />
        </div>

        {/* System Question 2 */}
        <div>
          <Label htmlFor="system-q2" className="block mb-3 font-semibold text-gray-900">
            System Question 2 <span className="text-red-500">*</span>
          </Label>
          <select
            id="system-q2"
            value={selectedQ2}
            onChange={(e) => setSelectedQ2(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          >
            <option value="">Select a question...</option>
            {SYSTEM_QUESTIONS.map((q) => (
              <option key={q} value={q} disabled={q === selectedQ1}>
                {q}
              </option>
            ))}
          </select>
          <Input
            type="text"
            placeholder="Your answer..."
            value={answer2}
            onChange={(e) => setAnswer2(e.target.value)}
            disabled={isLoading || !selectedQ2}
            maxLength={500}
            className="mt-2"
          />
        </div>

        {/* Custom Question */}
        <div>
          <Label htmlFor="custom-q" className="block mb-3 font-semibold text-gray-900">
            Custom Security Question <span className="text-red-500">*</span>
          </Label>
          <p className="text-sm text-gray-600 mb-2">Create your own security question that only you would know the answer to.</p>
          <Input
            id="custom-q"
            type="text"
            placeholder="e.g., What is my pet's name?"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={isLoading}
            className="mb-2"
            maxLength={255}
          />
          <Input
            type="text"
            placeholder="Your answer..."
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            disabled={isLoading}
            maxLength={500}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Security Questions'}
          </Button>
          {onSkip && (
            <Button
              type="button"
              variant="outline"
              onClick={onSkip}
              disabled={isLoading}
              className="px-6"
            >
              Skip
            </Button>
          )}
        </div>
      </form>
    </div>
  );

  if (displayMode === 'embedded') {
    return setupForm;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4 py-8">
      <div className="w-full max-w-2xl">
        {setupForm}

        <p className="text-center text-xs text-gray-500 mt-6">
          Your security questions are encrypted and only used for account recovery
        </p>
      </div>
    </div>
  );
}
