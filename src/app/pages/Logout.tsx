import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate logout process
    const timer = setTimeout(() => {
      toast.success('You have been logged out successfully');
      navigate('/login');
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">AI</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">FlowBoard</h1>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-w-[320px]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Logging out...</h2>
          <p className="text-sm text-gray-600">Please wait while we sign you out</p>
        </div>
      </div>
    </div>
  );
}
