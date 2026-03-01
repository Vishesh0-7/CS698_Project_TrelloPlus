import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMeetingStore } from '../store/meetingStore';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function MeetingTranscript() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const meeting = useMeetingStore((s) => s.meetings.find((m) => m.id === meetingId));
  const updateMeeting = useMeetingStore((s) => s.updateMeeting);
  const generateSummary = useMeetingStore((s) => s.generateSummary);

  const [transcript, setTranscript] = useState(meeting?.transcript || '');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!meeting) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    );
  }

  const handleBack = () => {
    if (meeting.projectId) {
      navigate(`/project/${meeting.projectId}`);
    } else {
      navigate('/meetings');
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript.trim()) {
      toast.error('Please paste a meeting transcript first');
      return;
    }

    setIsGenerating(true);
    
    // Save transcript
    if (meetingId) {
      updateMeeting(meetingId, { transcript: transcript.trim() });
    }

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (meetingId) {
      generateSummary(meetingId);
    }

    setIsGenerating(false);
    toast.success('Summary generated successfully!');
    navigate(`/meetings/${meetingId}`);
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {meeting.projectId ? 'Back to Project' : 'Back to Meetings'}
          </Button>
        </div>

        {/* Meeting Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{meeting.title}</h1>
          <p className="text-gray-600">
            {new Date(meeting.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at {meeting.time}
          </p>
        </div>

        {/* Transcript Input */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting Transcript</h2>
            <p className="text-gray-600">
              Paste your meeting transcript below to generate action items, decisions, and changes
            </p>
          </div>

          <Textarea
            placeholder="Paste your meeting transcript here...&#10;&#10;Example:&#10;John: Let's start with the Q1 planning...&#10;Sarah: I think we should focus on the new dashboard feature...&#10;Mike: Agreed. I can work on the wireframes this week..."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[400px] font-mono text-sm mb-6"
          />

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/meetings')}
              className="flex-1"
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateSummary}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={isGenerating || !transcript.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Summary & Approval Items
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}