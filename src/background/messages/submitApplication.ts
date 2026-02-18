// Message handler for submitting application
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import type { Answer, UserProfile } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[submitApplication] Received request');

  try {
    const { applicationId, userId, approvedAnswers, userProfile } = req.body as {
      applicationId: string;
      userId: string;
      approvedAnswers: Answer[];
      userProfile?: Partial<UserProfile>;
    };

    if (!applicationId || !userId || !approvedAnswers) {
      throw new Error('Application ID, User ID, and approved answers are required');
    }

    console.log(`[submitApplication] Submitting with ${approvedAnswers.length} approved answers`);

    // Call Flash API to approve and submit
    const result = await flashAPI.approveApplication(
      applicationId,
      userId,
      approvedAnswers,
      userProfile
    );

    // Add to recent jobs
    const recentJobs = await flashStorage.get('recentJobs') || [];
    const session = await flashStorage.get('currentSession');
    
    if (session?.currentJob) {
      recentJobs.unshift({
        id: applicationId,
        title: session.currentJob.job_id,
        company: 'Unknown', // Would need to be passed
        url: window.location.href,
        appliedAt: new Date().toISOString(),
        status: 'submitted',
      });
      await flashStorage.set('recentJobs', recentJobs.slice(0, 20)); // Keep last 20
    }

    // Clear current session
    await flashStorage.remove('currentSession');
    await flashStorage.remove('formCache');

    console.log('[submitApplication] Application submitted successfully:', result.application_id);

    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[submitApplication] Error:', error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit application',
    });
  }
};

export default handler;
