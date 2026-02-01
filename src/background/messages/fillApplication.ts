// Message handler for filling entire application
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import { flashStorage } from '~lib/storage/chrome';
import type { FormField } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[fillApplication] Received request');

  try {
    const { formFields, userId, jobId } = req.body as {
      formFields: FormField[];
      userId: string;
      jobId?: string;
    };

    if (!formFields || formFields.length === 0) {
      throw new Error('Form fields are required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log(`[fillApplication] Processing ${formFields.length} fields`);

    // Call Flash API to fill application
    const result = await flashAPI.fillApplication(formFields, userId, jobId);

    // Cache the answers
    const answersCache = await flashStorage.get('answersCache') || [];
    answersCache.push({
      questionHash: `${jobId || 'unknown'}-${Date.now()}`,
      question: 'Application Form',
      answer: JSON.stringify(result.answers),
      confidence: result.overall_confidence,
      cachedAt: new Date().toISOString(),
    });
    await flashStorage.set('answersCache', answersCache.slice(-50)); // Keep last 50

    console.log('[fillApplication] Generated', result.answers.length, 'answers');
    console.log('[fillApplication] Overall confidence:', result.overall_confidence);

    // Filter answers by confidence threshold
    const prefs = await flashStorage.get('preferences');
    const minConfidence = prefs?.minConfidence || 0.5;
    
    const filteredAnswers = result.answers.filter(
      (answer) => answer.confidence >= minConfidence
    );

    console.log(`[fillApplication] ${filteredAnswers.length}/${result.answers.length} answers meet confidence threshold`);

    res.send({
      success: true,
      data: {
        ...result,
        filteredAnswers,
        threshold: minConfidence,
      },
    });
  } catch (error) {
    console.error('[fillApplication] Error:', error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fill application',
    });
  }
};

export default handler;
