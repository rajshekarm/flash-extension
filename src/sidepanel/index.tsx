// Side Panel - Main workspace for Flash Assistant
import '~style.css';
import { useState, useEffect } from 'react';
import { Button } from '~components/Button';
import { Card } from '~components/Card';
import { Spinner } from '~components/Spinner';
import { ConfidenceScore } from '~components/ConfidenceScore';

type Step = 'detection' | 'analysis' | 'filling' | 'review';

export default function SidePanel() {
  const [currentStep, setCurrentStep] = useState<Step>('detection');
  const [loading, setLoading] = useState(true);
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [forms, setForms] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [filling, setFilling] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      // Get the window's active tab (side panel context)
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      
      if (!tab?.id) {
        console.log('[Side Panel] No active tab found');
        setLoading(false);
        return;
      }

      console.log('[Side Panel] Loading data from tab:', tab.id, tab.url);

      // Get job info and forms from content script
      const jobResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
      const formsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FORMS' });

      console.log('[Side Panel] Job response:', jobResponse);
      console.log('[Side Panel] Forms response:', formsResponse);

      setJobInfo(jobResponse.data);
      setForms(formsResponse.data);
    } catch (error) {
      console.error('[Side Panel] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeJob() {
    setAnalyzing(true);
    try {
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (!tab?.id) return;

      console.log("requesting analyse job")
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_JOB' });
      
      if (response.success) {
        setAnalysis(response.data);
        setCurrentStep('analysis');
      } else {
        alert(`Failed to analyze: ${response.error}`);
      }
    } catch (error) {
      alert('Error analyzing job');
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFillApplication() {
    if (!forms?.forms?.length) {
      alert('❌ No forms detected. Please navigate to a job application page.');
      return;
    }

    setFilling(true);
    try {
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (!tab?.id) {
        alert('❌ Could not find active tab');
        return;
      }

      console.log('[Side Panel] Fill All Fields - Starting...');

      // Step 1: Generate answers
      const fillResponse = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_APPLICATION' });
      
      if (!fillResponse.success) {
        alert(`❌ Failed to generate answers:\n\n${fillResponse.error}`);
        return;
      }

      const answers = fillResponse.data?.answers || [];
      console.log(`[Side Panel] Generated ${answers.length} answers`);

      if (answers.length === 0) {
        alert('⚠️ No answers generated. Please ensure:\n• Form fields are detected\n• User profile is set up\n• Backend API is running');
        return;
      }

      // Step 2: Inject answers immediately
      const injectResponse = await chrome.tabs.sendMessage(tab.id, { 
        type: 'INJECT_ANSWERS',
        payload: { answers }
      });

      if (injectResponse.success) {
        const result = injectResponse.data;
        setAnswers(answers);
        setCurrentStep('review');
        alert(`✅ Form filled successfully!\n\n📊 Results:\n• Filled: ${result.filled} fields\n• Skipped: ${result.skipped}\n• Failed: ${result.failed}\n\n⚠️ Please review the form before submitting.`);
      } else {
        alert(`❌ Failed to fill form:\n\n${injectResponse.error}`);
      }

    } catch (error) {
      console.error('[Side Panel] Error filling application:', error);
      alert(`❌ Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFilling(false);
    }
  }

  async function handleGenerateAnswers() {
    setGenerating(true);
    try {
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (!tab?.id) return;

      console.log('[Sidepanel] Fill All Fields - Starting...');
      
      // Step 1: Generate answers
      const fillResponse = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_APPLICATION' });
      
      if (!fillResponse.success) {
        const errorMsg = fillResponse.error || 'Unknown error occurred';
        alert(`❌ Failed to generate answers:\n\n${errorMsg}\n\nTroubleshooting:\n• Ensure backend API is running\n• Check user profile is configured\n• Check browser console for details`);
        return;
      }

      const answers = fillResponse.data?.answers || [];
      console.log(`[Sidepanel] Generated ${answers.length} answers`);
      
      if (answers.length === 0) {
        alert('⚠️ No answers generated. Please ensure:\n• Form fields are detected\n• User profile is set up\n• Backend API is running');
        return;
      }

      setAnswers(answers);

      // Step 2: Immediately inject answers
      const injectResponse = await chrome.tabs.sendMessage(tab.id, { 
        type: 'INJECT_ANSWERS',
        payload: { answers }
      });

      if (injectResponse.success && injectResponse.data) {
        const result = injectResponse.data;
        console.log('[Sidepanel] Injection result:', result);
        setCurrentStep('review');
        alert(`✅ Form filled successfully!\n\n📊 Results:\n• Filled: ${result.filled}\n• Skipped: ${result.skipped}\n• Failed: ${result.failed}\n\n⚠️ Please review the form before submitting.`);
      } else {
        // Keep answers visible even if injection fails
        setCurrentStep('filling');
        alert(`❌ Failed to inject answers:\n\n${injectResponse.error || 'Unknown error'}\n\nAnswers are still available for manual review.`);
      }

    } catch (error) {
      console.error('[Sidepanel] Error:', error);
      alert(`❌ Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleInjectAnswers() {
    setInjecting(true);
    try {
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (!tab?.id) return;

      console.log(`[Sidepanel] Injecting ${answers.length} answers into form`);
      const response = await chrome.tabs.sendMessage(tab.id, { 
        type: 'INJECT_ANSWERS',
        payload: { answers }
      });
      
      if (response.success) {
        const result = response.data;
        console.log('[Sidepanel] Injection result:', result);
        setCurrentStep('review');
        alert(`✅ Answers injected successfully!\n\n📊 Results:\n• Filled: ${result.filled}\n• Skipped: ${result.skipped}\n• Failed: ${result.failed}\n\n⚠️ Please review the form before submitting.`);
      } else {
        alert(`❌ Failed to inject answers:\n\n${response.error}`);
      }
    } catch (error) {
      console.error('[Sidepanel] Error injecting answers:', error);
      alert(`❌ Error injecting answers:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setInjecting(false);
    }
  }

  const steps = [
    { id: 'detection', label: 'Detection', icon: '🔍' },
    { id: 'analysis', label: 'Analysis', icon: '📊' },
    { id: 'filling', label: 'Filling', icon: '✍️' },
    { id: 'review', label: 'Review', icon: '👁️' },
  ];

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚡</span>
          <div>
            <h1 className="text-xl font-bold">Flash Assistant</h1>
            <p className="text-sm text-primary-100">Application Workflow</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id as Step)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentStep === step.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="text-lg">{step.icon}</span>
                <span className="text-sm font-medium">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className="w-8 h-px bg-gray-300 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Detection Step */}
        {currentStep === 'detection' && (
          <>
            <Card>
              <h3 className="font-semibold mb-4">Job Detection</h3>
              {jobInfo ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600">✓</span>
                      <span className="font-semibold text-green-900">Job Detected</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{jobInfo.title}</p>
                    {jobInfo.company && (
                      <p className="text-xs text-gray-600">📍 {jobInfo.company}</p>
                    )}
                    {jobInfo.location && (
                      <p className="text-xs text-gray-600">🌎 {jobInfo.location}</p>
                    )}
                    {jobInfo.description && (
                      <p className="text-xs text-gray-500 mt-2">
                        Description: {jobInfo.description.length} characters
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <p className="text-gray-600">No job detected on this page</p>
                  <p className="text-xs text-gray-500 mt-1">Navigate to a job posting</p>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold mb-4">Form Detection</h3>
              {forms?.forms?.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600">✓</span>
                      <span className="font-semibold text-green-900">
                        {forms.forms.length} Form(s) Detected
                      </span>
                    </div>
                    {forms.forms.map((form: any, idx: number) => (
                      <div key={idx} className="mt-2 text-sm">
                        <p className="text-gray-700">
                          Form {idx + 1}: {form.fields.length} fields
                        </p>
                        {form.confidence && (
                          <p className="text-xs text-gray-600">
                            Confidence: {Math.round(form.confidence * 100)}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <p className="text-gray-600">No application forms detected</p>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-3">
                {/* Primary Action - Fill Form */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleFillApplication}
                  loading={filling}
                  disabled={!forms?.forms?.length || filling}
                >
                  {filling ? 'Filling...' : '⚡ Fill All Fields Now'}
                </Button>
                <p className="text-xs text-gray-500 text-center -mt-1">
                  One-click form filling with AI-generated answers
                </p>

                {/* Optional - Analyze Job */}
                <details className="mt-3">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                    Optional: Analyze job match first
                  </summary>
                  <Button
                    variant="secondary"
                    className="w-full mt-2"
                    onClick={handleAnalyzeJob}
                    loading={analyzing}
                    disabled={!jobInfo || analyzing}
                  >
                    {analyzing ? 'Analyzing...' : '📊 Analyze Job Match'}
                  </Button>
                </details>
              </div>
            </Card>
          </>
        )}

        {/* Analysis Step */}
        {currentStep === 'analysis' && (
          <>
            {analysis ? (
              <>
                <Card>
                  <h3 className="font-semibold mb-4">Job Analysis</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Match Score</p>
                      <ConfidenceScore score={analysis.matchScore || 0.75} />
                    </div>
                    {analysis.summary && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Summary</p>
                        <p className="text-sm text-gray-900">{analysis.summary}</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Card>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleGenerateAnswers}
                    loading={generating}
                    disabled={!forms?.forms?.length || generating}
                  >
                    {generating ? 'Filling Form...' : '⚡ Fill All Fields Now'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Generates answers and fills form in one click
                  </p>
                </Card>
              </>
            ) : (
              <Card>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No analysis available</p>
                  <Button variant="primary" onClick={handleAnalyzeJob} loading={analyzing}>
                    Analyze Job Now
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Filling Step */}
        {currentStep === 'filling' && (
          <>
            {answers.length > 0 ? (
              <>
                <Card>
                  <h3 className="font-semibold mb-4">Generated Answers ({answers.length})</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    ⚠️ Answers generated but injection may have failed. Review below:
                  </p>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {answers.map((answer: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {answer.question || answer.field_label || `Field ${idx + 1}`}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{answer.answer}</p>
                        {answer.confidence !== undefined && (
                          <div className="mt-2">
                            <ConfidenceScore score={answer.confidence} size="sm" />
                          </div>
                        )}
                        {answer.sources && answer.sources.length > 0 && (
                          <div className="mt-1">
                            <p className="text-xs text-gray-500">
                              📚 Sources: {answer.sources.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleInjectAnswers}
                    loading={injecting}
                    disabled={injecting}
                  >
                    {injecting ? 'Injecting...' : '💉 Retry Injection'}
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Manually retry filling the form
                  </p>
                </Card>
              </>
            ) : (
              <Card>
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No answers available</p>
                  <Button variant="primary" onClick={() => setCurrentStep('analysis')}>
                    Go Back
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* Review Step */}
        {currentStep === 'review' && (
          <>
            <Card>
              <div className="text-center py-8">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Answers Injected!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please review the form on the page and make any necessary edits before submitting.
                </p>
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 text-left">
                  <div className="flex items-start gap-2">
                    <span className="text-warning-600">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-warning-900">Important</p>
                      <p className="text-xs text-warning-800 mt-1">
                        Always review AI-generated content before submission. Flash assists but doesn't replace your judgment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setCurrentStep('detection')}
              >
                🔄 Start New Application
              </Button>
            </Card>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Flash v0.1.0</span>
          <button
            className="text-primary-600 hover:text-primary-700"
            onClick={() => chrome.runtime.openOptionsPage()}
          >
            Settings →
          </button>
        </div>
      </div>
    </div>
  );
}
