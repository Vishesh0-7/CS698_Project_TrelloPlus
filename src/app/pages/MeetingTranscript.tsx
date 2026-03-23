import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft, Sparkles, Loader2, Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { apiService, type MeetingResponse } from '../services/api';
import { formatMeetingDate, formatMeetingTime } from '../utils/meetingDateTime';

const MEETING_TRANSCRIPT_SYNC_INTERVAL_MS = 5000;

export function MeetingTranscript() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const toJoinHref = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const loadMeeting = useCallback(async ({ showErrorToast = false }: { showErrorToast?: boolean } = {}) => {
    if (!meetingId) return;

    try {
      const meetingData = await apiService.getMeeting(meetingId);
      setMeeting(meetingData);
    } catch (error) {
      if (showErrorToast) {
        toast.error(error instanceof Error ? error.message : 'Failed to load meeting');
      }
    }
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) return;

    let isCancelled = false;

    void loadMeeting({ showErrorToast: true });

    const syncIfActive = () => {
      if (isCancelled || document.visibilityState !== 'visible') {
        return;
      }

      void loadMeeting();
    };

    const intervalId = window.setInterval(syncIfActive, MEETING_TRANSCRIPT_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfActive);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', syncIfActive);
    };
  }, [meetingId, loadMeeting]);

  if (!meeting) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    );
  }

  const isScheduledMeeting = meeting.status === 'SCHEDULED';

  const handleBack = () => {
    if (meeting?.projectId) {
      navigate(`/project/${meeting.projectId}`);
    } else {
      navigate('/meetings');
    }
  };

  const handleGenerateSummary = async () => {
    if (!meetingId) {
      return;
    }

    setIsGenerating(true);

    try {
      if (transcript.trim()) {
        await apiService.endMeeting(meetingId, transcript.trim());
      }
      await apiService.generateSummary(meetingId);
      toast.success('Summary generated successfully!');
      navigate(`/meetings/${meetingId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
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
            {meeting?.projectId ? 'Back to Project' : 'Back to Meetings'}
          </Button>
        </div>

        {/* Meeting Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{meeting.title}</h1>
          <p className="text-gray-600 mb-1">Project: {meeting.projectName || 'N/A'}</p>
          <p className="text-gray-600">
            {formatMeetingDate(meeting.meetingDate, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at {formatMeetingTime(meeting.meetingTime)}
          </p>
          {isScheduledMeeting && (
            <div className="mt-3 space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 flex-shrink-0" />
                <span>{meeting.platform?.trim() || 'Platform not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                {toJoinHref(meeting.meetingLink) ? (
                  <a
                    href={toJoinHref(meeting.meetingLink) || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    Join meeting
                  </a>
                ) : (
                  <span>Join link not set</span>
                )}
              </div>
            </div>
          )}
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
            disabled={!isScheduledMeeting || isGenerating}
          />

          {!isScheduledMeeting && (
            <p className="text-sm text-amber-700 mb-4">
              This meeting is no longer scheduled, so transcript editing and rescheduling actions are disabled.
            </p>
          )}

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
              disabled={isGenerating || !isScheduledMeeting}
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