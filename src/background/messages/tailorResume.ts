// Message handler for resume tailoring
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import type { JobAnalysis, UserProfile } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[tailorResume] Received request');

  try {
    const { jobId, userId, jobAnalysis, userProfile } = req.body as {
      jobId: string;
      userId: string;
      jobAnalysis?: JobAnalysis;
      userProfile?: Partial<UserProfile>;
    };

    if (!jobId || !userId) {
      throw new Error('Job ID and User ID are required');
    }

    // Call Flash API to tailor resume
    const tailoredResume = await flashAPI.tailorResume(jobId, userId, jobAnalysis, userProfile);

    // Check guardrails
    const failedGuardrails = tailoredResume.guardrail_checks.filter((check) => !check.passed);
    
    if (failedGuardrails.length > 0) {
      console.warn('[tailorResume] Guardrail checks failed:', failedGuardrails);
    }

    console.log('[tailorResume] Resume tailored successfully');

    res.send({
      success: true,
      data: tailoredResume,
    });
  } catch (error) {
    console.error('[tailorResume] Error:', error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to tailor resume',
    });
  }
};

export default handler;
