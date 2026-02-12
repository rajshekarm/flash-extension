// Side Panel - Main workspace for Flash Assistant
import '~style.css';
import { useState, useEffect } from 'react';
import { Button } from '~components/Button';
import { Card } from '~components/Card';
import { Spinner } from '~components/Spinner';
import { ConfidenceScore } from '~components/ConfidenceScore';
import { Input } from '~components/Input';
import { AuthGuard } from '~components/AuthGuard';
import { 
  getUserFriendlyErrorMessage, 
  getErrorActionSuggestions,
  parseUserProfileError 
} from '~lib/utils/userProfileErrors';
import { flashStorage } from '~lib/storage/chrome';

type Step = 'detection' | 'analysis' | 'filling' | 'review';

function MainSidePanelContent() {
  const [currentStep, setCurrentStep] = useState<Step>('detection');
  const [loading, setLoading] = useState(true);
  const [detectingForms, setDetectingForms] = useState(false);
  const [jobInfo, setJobInfo] = useState<any>(null);
  const [forms, setForms] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [filling, setFilling] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', skills: '' });
  const [savingProfile, setSavingProfile] = useState(false);

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
      
      // Check auth directly from storage instead of getCurrentAuthUser
      const authSession = await flashStorage.get('authSession');
      let userProfileData = null;
      
      console.log('[Side Panel] Auth session:', { 
        hasSession: !!authSession, 
        userId: authSession?.user?.id 
      });
      
      if (authSession?.user) {
        try {
          const profileResponse = await chrome.runtime.sendMessage({
            name: 'getUserProfile',
            body: { userId: authSession.user.id }
          });
          
          if (profileResponse?.success) {
            userProfileData = profileResponse.data;
          }
        } catch (error) {
          console.warn('[Side Panel] Failed to load user profile:', error);
        }
      }

      console.log('[Side Panel] Job response:', jobResponse);
      console.log('[Side Panel] Forms response:', formsResponse);
      console.log('[Side Panel] User profile data:', userProfileData);

      setJobInfo(jobResponse.data);
      setForms(formsResponse.data);
      if (userProfileData) {
        setUserProfile(userProfileData);
        setProfileForm((prev) => ({
          ...prev,
          name: userProfileData?.name || '',
          email: userProfileData?.email || '',
          phone: userProfileData?.phone || '',
          skills: (userProfileData?.skills || []).join(', '),
        }));
      } else {
        // If no profile exists, pre-fill with auth user data
        if (authSession?.user) {
          setProfileForm((prev) => ({
            ...prev,
            name: authSession.user.name || '',
            email: authSession.user.email || '',
          }));
        }
      }
    } catch (error) {
      console.error('[Side Panel] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileForm.name || !profileForm.email) {
      alert('Name and email are required to create a profile.');
      return;
    }

    setSavingProfile(true);
    try {
      // DEBUG: Check what's actually in Chrome storage using raw API
      const rawStorage = await chrome.storage.local.get(['authSession', 'authToken', 'refreshToken']);
      console.log('[handleSaveProfile] RAW Chrome Storage:', rawStorage);
      
      // Check auth directly from storage instead of relying on getCurrentAuthUser
      let authSession = await flashStorage.get('authSession');
      let authToken = await flashStorage.get('authToken');
      
      console.log('[handleSaveProfile] FlashStorage.get() results:', { 
        hasSession: !!authSession, 
        hasToken: !!authToken,
        userId: authSession?.user?.id,
        sessionDetails: authSession ? {
          hasUser: !!authSession.user,
          userName: authSession.user?.name,
          userEmail: authSession.user?.email,
          expiresAt: authSession.expires_at,
          tokenType: authSession.token_type
        } : null,
        tokenLength: authToken ? authToken.length : 0
      });
      
      // If storage check fails, try verifying through background message handler
      if (!authSession || !authToken || !authSession.user) {
        console.log('[handleSaveProfile] Direct storage check failed, trying background message...');
        
        try {
          const authCheck = await chrome.runtime.sendMessage({
            name: 'checkAuth',
            body: {}
          });
          
          console.log('[handleSaveProfile] Background auth check result:', authCheck);
          
          if (!authCheck?.authenticated || !authCheck?.data) {
            setSavingProfile(false);
            alert('Authentication required. Please log out and log back in.\n\nYour session may have expired or storage may be corrupted.');
            return;
          }
          
          // If background check passed, retrieve from storage again
          authSession = await flashStorage.get('authSession');
          authToken = await flashStorage.get('authToken');
          
          if (!authSession || !authToken || !authSession.user) {
            setSavingProfile(false);
            alert('Storage access error. Please try:\n1. Refreshing the page\n2. Reloading the extension\n3. Logging out and back in');
            return;
          }
        } catch (checkError) {
          console.error('[handleSaveProfile] Background auth check failed:', checkError);
          setSavingProfile(false);
          alert('Extension communication error. Please try:\n1. Refreshing the page\n2. Reloading the extension');
          return;
        }
      }
      
      // At this point, authSession and authToken are guaranteed to be non-null
      // Check if token is expired
      const expiresAt = new Date(authSession.expires_at);
      const now = new Date();
      
      if (expiresAt <= now) {
        setSavingProfile(false);
        console.error('[handleSaveProfile] Token expired:', {
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString()
        });
        alert('Your session has expired. Please log out and log back in.');
        return;
      }

      const profileData = {
        id: userProfile?.id || authSession.user.id,
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone || undefined,
        skills: profileForm.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        experience: userProfile?.experience || [],
        education: userProfile?.education || [],
      };

      let response;
      try {
        if (userProfile?.id) {
          // Update existing profile
          response = await chrome.runtime.sendMessage({
            name: 'updateUserProfile',
            body: { userId: userProfile.id, profile: profileData }
          });
        } else {
          // Create new profile for authenticated user
          response = await chrome.runtime.sendMessage({
            name: 'createUserProfile',
            body: { profile: profileData }
          });
        }
      } catch (messageError) {
        console.error('[handleSaveProfile] Message error:', messageError);
        setSavingProfile(false);
        alert('Extension communication error. Try reloading the page.');
        return;
      }

      if (response?.success) {
        setUserProfile(response.data);
        setProfileForm((prev) => {
          const fallbackSkills = prev.skills
            ?.split(',')
            .map((skill) => skill.trim())
            .filter(Boolean)
            .join(', ');

          return {
            ...prev,
            name: response.data?.name || prev.name,
            email: response.data?.email || prev.email,
            phone: response.data?.phone || prev.phone,
            skills: response.data?.skills
              ? response.data.skills.join(', ')
              : fallbackSkills || prev.skills,
          };
        });
        
        const message = userProfile?.id 
          ? `Profile updated successfully${response.warning ? `\n\n⚠️ ${response.warning}` : ''}`
          : `Profile created successfully${response.warning ? `\n\n⚠️ ${response.warning}` : ''}`;
        alert(message);
      } else {
        const profileError = parseUserProfileError({ 
          message: response.error, 
          errorType: response.errorType 
        });
        const friendlyMessage = getUserFriendlyErrorMessage(profileError);
        const suggestions = getErrorActionSuggestions(profileError);
        
        alert(`${friendlyMessage}\n\nSuggestions:\n• ${suggestions.join('\n• ')}`);
      }
    } catch (error) {
      console.error('[Side Panel] Error saving profile:', error);
      
      const profileError = parseUserProfileError(error);
      const friendlyMessage = getUserFriendlyErrorMessage(profileError);
      const suggestions = getErrorActionSuggestions(profileError);
      
      alert(`${friendlyMessage}\n\nSuggestions:\n• ${suggestions.join('\n• ')}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeleteProfile() {
    if (!userProfile?.id) {
      alert('No profile to delete.');
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete your profile?\n\nThis action cannot be undone.\n\nProfile: ${userProfile.name} (${userProfile.email})`);
    if (!confirmed) return;

    setSavingProfile(true);
    try {
      const response = await chrome.runtime.sendMessage({
        name: 'deleteUserProfile',
        body: { userId: userProfile.id }
      });

      if (response.success) {
        setUserProfile(null);
        setProfileForm({
          name: '',
          email: '',
          phone: '',
          skills: '',
        });
        
        const message = response.warning 
          ? `Profile deleted locally.\n\n⚠️ ${response.warning}`
          : 'Profile deleted successfully.';
        alert(message);
      } else {
        const profileError = parseUserProfileError({ 
          message: response.error, 
          errorType: response.errorType 
        });
        const friendlyMessage = getUserFriendlyErrorMessage(profileError);
        const suggestions = getErrorActionSuggestions(profileError);
        
        alert(`${friendlyMessage}\n\nSuggestions:\n• ${suggestions.join('\n• ')}`);
      }
    } catch (error) {
      console.error('[Side Panel] Error deleting profile:', error);
      
      const profileError = parseUserProfileError(error);
      const friendlyMessage = getUserFriendlyErrorMessage(profileError);
      const suggestions = getErrorActionSuggestions(profileError);
      
      alert(`${friendlyMessage}\n\nSuggestions:\n• ${suggestions.join('\n• ')}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDetectForms() {
    setDetectingForms(true);
    try {
      const window = await chrome.windows.getCurrent();
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (!tab?.id) {
        alert('❌ Could not find the active tab');
        return;
      }

      console.log('[Side Panel] Requesting form detection');
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'DETECT_FORMS' });

      if (response.success) {
        setForms(response.data);
        setCurrentStep('detection');
      } else {
        alert(`❌ Failed to detect forms:\n\n${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Side Panel] Error detecting forms:', error);
      alert(`❌ Error detecting forms:\n\n${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDetectingForms(false);
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold mb-2">Your Profile</h3>
                <span className={`text-xs ${userProfile?.id ? 'text-green-600' : 'text-gray-500'}`}>
                  {userProfile?.id ? 'Linked to your account' : 'Required for AI features'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Create or update your profile so Flash can personalize applications and know which user ID to call APIs with.
              </p>
              <div className="space-y-3">
                <Input
                  label="Full Name"
                  value={profileForm.name}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Alex Johnson"
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="name@example.com"
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={profileForm.phone}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="(123) 456-7890"
                />
                <Input
                  label="Skills (comma separated)"
                  value={profileForm.skills}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, skills: event.target.value }))
                  }
                  placeholder="JavaScript, Python, SQL"
                  helperText="Used for resume tailoring and answer generation"
                />
              </div>
              <Button
                variant="primary"
                className="w-full mt-3"
                onClick={handleSaveProfile}
                loading={savingProfile}
              >
                {userProfile?.id ? 'Update Profile' : 'Save Profile'}
              </Button>
              {userProfile?.id && (
                <>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={handleDeleteProfile}
                      loading={savingProfile}
                    >
                      Delete Profile
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Profile ID: {userProfile.id}
                  </p>
                </>
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

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleDetectForms}
                  loading={detectingForms}
                  disabled={detectingForms}
                >
                  {detectingForms ? 'Scanning forms...' : '🔄 Re-scan Forms'}
                </Button>
                <p className="text-xs text-gray-500 text-center -mt-1">
                  Refresh the DOM scan if you navigated to a new application form.
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

export default function SidePanel() {
  return (
    <AuthGuard>
      <MainSidePanelContent />
    </AuthGuard>
  );
}
