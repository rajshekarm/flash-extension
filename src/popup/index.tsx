// Popup - Main entry point
import '~style.css';
import { useState, useEffect } from 'react';
import { Button } from '~components/Button';
import { Card } from '~components/Card';
import { Spinner } from '~components/Spinner';
import { sendMessage } from '~lib/utils/helpers';

export default function Popup() {
  const [loading, setLoading] = useState(true);
  const [jobDetected, setJobDetected] = useState(false);
  const [formsDetected, setFormsDetected] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    checkPageStatus();
  }, []);

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

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_JOB' });
      
      if (response.success) {
        alert('Job analyzed successfully! Open the side panel to view details.');
      } else {
        alert(`Failed to analyze job: ${response.error}`);
      }
    } catch (error) {
      alert('Error analyzing job');
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleOpenSidePanel() {
    await sendMessage({ type: 'OPEN_SIDEPANEL' });
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
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <h1 className="text-lg font-bold">Flash Assistant</h1>
            <p className="text-xs text-primary-100">AI Job Application Helper</p>
          </div>
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
              <h3 className="font-semibold mb-3">Actions</h3>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleAnalyzeJob}
                  loading={analyzing}
                  disabled={!jobDetected}
                >
                  {analyzing ? 'Analyzing...' : 'Analyze Job'}
                </Button>
                
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={handleOpenSidePanel}
                >
                  Open Side Panel
                </Button>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleOpenOptions}
                >
                  Settings
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
