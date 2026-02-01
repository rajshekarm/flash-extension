// Side Panel - Main entry point
import '~style.css';
import { useState } from 'react';
import { Button } from '~components/Button';
import { Card, CardHeader, CardBody } from '~components/Card';

export default function SidePanel() {
  const [currentStep, setCurrentStep] = useState<'detection' | 'analysis' | 'filling' | 'review'>('detection');

  const steps = [
    { id: 'detection', label: 'Detection', icon: '🔍' },
    { id: 'analysis', label: 'Analysis', icon: '📊' },
    { id: 'filling', label: 'Filling', icon: '✍️' },
    { id: 'review', label: 'Review', icon: '👁️' },
  ];

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
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  currentStep === step.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500'
                }`}
              >
                <span className="text-lg">{step.icon}</span>
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="w-8 h-px bg-gray-300 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card>
          <CardHeader
            title="Welcome to Flash"
            subtitle="Your AI-powered job application assistant"
          />
          <CardBody>
            <div className="space-y-4">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h3 className="font-semibold text-primary-900 mb-2">How it works:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-primary-800">
                  <li>Navigate to a job posting on supported platforms</li>
                  <li>Flash detects the job and application forms</li>
                  <li>Click "Analyze Job" to understand requirements</li>
                  <li>Review AI-generated answers for each field</li>
                  <li>Approve and submit your application</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Supported Platforms:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['LinkedIn', 'Greenhouse', 'Lever', 'Workday', 'Indeed', 'Glassdoor'].map((platform) => (
                    <div
                      key={platform}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg"
                    >
                      <span className="text-success-500">✓</span>
                      <span className="text-sm">{platform}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-warning-600">⚠️</span>
                  <div>
                    <h4 className="font-semibold text-warning-900">Important</h4>
                    <p className="text-sm text-warning-800 mt-1">
                      Always review AI-generated answers before submission. Flash assists
                      but doesn't replace your judgment and expertise.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody>
            <div className="space-y-2">
              <Button variant="primary" className="w-full">
                Analyze Current Page
              </Button>
              <Button variant="secondary" className="w-full">
                View Application History
              </Button>
              <Button variant="secondary" className="w-full">
                Update Profile
              </Button>
            </div>
          </CardBody>
        </Card>
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
