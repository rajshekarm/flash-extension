// Message handler for answering a single question
import type { PlasmoMessaging } from '@plasmohq/messaging';
import { flashAPI } from '~lib/api';
import type { QuestionContext } from '~types';

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  console.log('[answerQuestion] Received request');

  try {
    const { questionContext, userId, jobId } = req.body as {
      questionContext: QuestionContext;
      userId: string;
      jobId?: string;
    };

    if (!questionContext || !userId) {
      throw new Error('Question context and User ID are required');
    }

    // Call Flash API to generate answer
    const answer = await flashAPI.answerQuestion(questionContext, userId, jobId);

    console.log('[answerQuestion] Answer generated with confidence:', answer.confidence);

    res.send({
      success: true,
      data: answer,
    });
  } catch (error) {
    console.error('[answerQuestion] Error:', error);
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to answer question',
    });
  }
};

export default handler;
