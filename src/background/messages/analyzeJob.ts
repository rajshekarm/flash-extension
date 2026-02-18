// Message handler for job analysis
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import type { JobDescription, UserProfile } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[analyzeJob] Received request', req.body);

  try {
    const { jobDescription, userId, userProfile } = req.body as {
      jobDescription: JobDescription;
      userId?: string;
      userProfile?: Partial<UserProfile>;
    };

    if (!jobDescription) {
      throw new Error('Job description is required');
    }

    console.log('[analyzeJob] Calling Flash API...', {
      title: jobDescription.title,
      userId: userId || 'none',
    });

    // Call Flash API to analyze job
    const analysis = await flashAPI.analyzeJob(jobDescription, userId, userProfile);

    // Store in session
    const session = await flashStorage.get('currentSession');
    await flashStorage.set('currentSession', {
      ...session,
      id: session?.id || `session-${Date.now()}`,
      startedAt: session?.startedAt || new Date().toISOString(),
      currentJob: analysis,
      status: 'analyzing',
    });

    console.log('[analyzeJob] Analysis complete:', analysis);

    res.send({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[analyzeJob] Error:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to analyze job';
    if (error instanceof Error) {
      if (error.message.includes('unreachable') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Backend API is not running. Please start the backend server at ' + (process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:8000');
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Backend may be overloaded or not responding.';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.send({
      success: false,
      error: errorMessage,
    });
  }
};

export default handler;
