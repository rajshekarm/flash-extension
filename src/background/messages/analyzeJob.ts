// Message handler for job analysis
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import type { JobDescription } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[analyzeJob] Received request');

  try {
    const { jobDescription, userId } = req.body as {
      jobDescription: JobDescription;
      userId?: string;
    };

    if (!jobDescription) {
      throw new Error('Job description is required');
    }

    // Call Flash API to analyze job
    const analysis = await flashAPI.analyzeJob(jobDescription, userId);

    // Store in session
    const session = await flashStorage.get('currentSession');
    await flashStorage.set('currentSession', {
      ...session,
      id: session?.id || `session-${Date.now()}`,
      startedAt: session?.startedAt || new Date().toISOString(),
      currentJob: analysis,
      status: 'analyzing',
    });

    console.log('[analyzeJob] Analysis complete:', analysis.job_id);

    res.send({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[analyzeJob] Error:', error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze job',
    });
  }
};

export default handler;
