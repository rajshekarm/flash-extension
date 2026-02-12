// Popup - Main entry point
import '~style.css';
import { useState, useEffect } from 'react';
import { Button } from '~components/Button';
import { Card } from '~components/Card';
import { Spinner } from '~components/Spinner';

export default function Popup() {
  const [loading, setLoading] = useState(true);
  const [jobDetected, setJobDetected] = useState(false);
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [formsDetected, setFormsDetected] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [filling, setFilling] = useState(false);
  const [connected, setConnected] = useState(false);
  const [autoFillEnabled, setAutoFillEnabled] = useState(false);

  useEffect(() => {
    checkPageStatus();
    loadAutoFillStatus();
  }, []);

  async function loadAutoFillStatus() {
    try {
      const prefs = await chrome.storage.sync.get('preferences');
      setAutoFillEnabled(prefs.preferences?.autoFill ?? false);
    } catch (error) {
      console.error('Error loading auto-fill status:', error);
    }
  }

  async function checkPageStatus() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        setLoading(false);
        return;
      }

      // Check if content script is active
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        if (response.success) {
          // Get detected job and forms
          const jobResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
          const formsResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_FORMS' });
          
          setJobInfo(jobResponse.data);
          setJobDetected(!!jobResponse.data);
          setFormsDetected(formsResponse.data?.forms?.length || 0);
          setConnected(true);
        }
      } catch {
        // Content script not injected
        setConnected(false);
      }
    } catch (error) {
      console.error('Error checking page status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeJob() {
    setAnalyzing(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      console.log('[Popup] Sending ANALYZE_JOB message to tab', tab.id);
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_JOB' });
      
      console.log('[Popup] Received response:', response);
      
      if (response.success) {
        // Immediately open sidepanel instead of showing alert
        chrome.sidePanel.open({ windowId: tab.windowId });
      } else {
        // Show more detailed error message
        const errorMsg = response.error || 'Unknown error occurred';
        alert(`❌ Failed to analyze job:\n\n${errorMsg}\n\nTroubleshooting:\n• Ensure backend API is running at ${process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:8000'}\n• Check browser console for details`);
      }
    } catch (error) {
      console.error('[Popup] Error analyzing job:', error);
      alert(`❌ Error analyzing job:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck browser console for more details.`);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFillApplication() {
    setFilling(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      console.log('[Popup] Fill All Fields - Starting...');

      // Step 1: Generate answers
      const fillResponse = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_APPLICATION' });
      
      if (!fillResponse.success) {
        alert(`❌ Failed to generate answers:\n\n${fillResponse.error}`);
        return;
      }

      const answers = fillResponse.data?.answers || [];
      console.log(`[Popup] Generated ${answers.length} answers`);

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
        alert(`✅ Form filled successfully!\n\n📊 Results:\n• Filled: ${result.filled} fields\n• Skipped: ${result.skipped}\n• Failed: ${result.failed}\n\n⚠️ Please review the form before submitting.`);
      } else {
        alert(`❌ Failed to fill form:\n\n${injectResponse.error}`);
      }

    } catch (error) {
      console.error('[Popup] Error filling application:', error);
      alert(`❌ Error:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFilling(false);
    }
  }

  async function handleToggleAutoFill() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_AUTO_FILL' });
      
      if (response.success) {
        setAutoFillEnabled(response.autoFillEnabled);
      }
    } catch (error) {
      console.error('Error toggling auto-fill:', error);
    }
  }

  async function handleOpenSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    }
  }

  async function handleOpenOptions() {
    chrome.runtime.openOptionsPage();
  }

  if (loading) {
    return (
      <div className="w-96 h-96 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-96 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-bold">Flash Assistant</h1>
              <p className="text-xs text-primary-100">AI Job Application Helper</p>
            </div>
          </div>
          <button
            onClick={handleOpenSidePanel}
            className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-colors"
            title="Open Side Panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Connection Status */}
        {!connected ? (
          <Card>
            <div className="text-center py-4">
              <p className="text-gray-600 mb-2">Not connected to a job board</p>
              <p className="text-sm text-gray-500">Navigate to a supported job board to activate Flash</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Job Info */}
            {jobInfo && (
              <Card>
                <h3 className="font-semibold mb-2">Detected Job</h3>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{jobInfo.title}</p>
                  {jobInfo.company && (
                    <p className="text-xs text-gray-600">📍 {jobInfo.company}</p>
                  )}
                  {jobInfo.location && (
                    <p className="text-xs text-gray-600">🌎 {jobInfo.location}</p>
                  )}
                  {jobInfo.description && (
                    <p className="text-xs text-gray-500 mt-2">
                      {jobInfo.description.substring(0, 100)}...
                    </p>
                  )}
                </div>
              </Card>
            )}

            {/* Detection Status */}
            <Card>
              <h3 className="font-semibold mb-3">Page Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Job Posting</span>
                  <span className={`flash-badge ${jobDetected ? 'flash-badge-success' : 'text-gray-400'}`}>
                    {jobDetected ? '✓ Detected' : '✗ Not Found'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Application Forms</span>
                  <span className={`flash-badge ${formsDetected > 0 ? 'flash-badge-success' : 'text-gray-400'}`}>
                    {formsDetected > 0 ? `${formsDetected} Found` : '✗ Not Found'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {/* Auto-Fill Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Auto-Fill Forms</p>
                      <p className="text-xs text-gray-500">Automatically fill applications</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAutoFill}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoFillEnabled ? 'bg-primary-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoFillEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleFillApplication}
                  loading={filling}
                  disabled={formsDetected === 0 || filling}
                >
                  {filling ? 'Filling...' : '⚡ Fill All Fields Now'}
                </Button>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleAnalyzeJob}
                  loading={analyzing}
                  disabled={!jobDetected || analyzing}
                >
                  {analyzing ? 'Analyzing...' : '📊 Analyze Job Match'}
                </Button>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleOpenSidePanel}
                >
                  📊 Open Side Panel
                </Button>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleOpenOptions}
                >
                  ⚙️ Settings
                </Button>
              </div>
            </Card>

            {/* Tips */}
            <Card className="bg-primary-50 border-primary-200">
              <div className="flex items-start gap-2">
                <span className="text-primary-600">💡</span>
                <div>
                  <p className="text-sm font-medium text-primary-900">Tip</p>
                  <p className="text-xs text-primary-700 mt-1">
                    Use the side panel for the full application workflow including form filling and answer review.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white">
        <p className="text-xs text-gray-500 text-center">
          Flash v0.1.0 • Made with AI
        </p>
      </div>
    </div>
  );
}
