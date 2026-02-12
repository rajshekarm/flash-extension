┌─────────────┐
│  Sidepanel  │ User clicks "Analyze Job Match" button
└──────┬──────┘
       │ handleAnalyzeJob() (line 57)
       │
       ▼ chrome.tabs.sendMessage(tabId, { type: 'ANALYZE_JOB' })
       │
┌──────────────────┐
│ Content Script   │ Message listener receives 'ANALYZE_JOB'
│   (job page)     │
└──────┬───────────┘
       │ analyzeJob() function (line 131)
       │
       ▼ sendToBackground({ name: "analyzeJob", body: {...} })
       │
┌──────────────────────────┐
│ Background Message       │ Plasmo routes to analyzeJob.ts handler
│ Handler (Service Worker) │
└──────┬───────────────────┘
       │
       ▼ flashAPI.analyzeJob(jobDescription, userId) (line 25)
       │
┌──────────────┐
│ Backend API  │ POST /api/flash/analyze-job
│ (FastAPI)    │ Azure OpenAI processes job
└──────┬───────┘
       │
       │ Returns JobAnalysis object
       │ { job_id, match_score, key_requirements, etc. }
       │
       ▼
┌──────────────────────────┐
│ Background Handler       │
│ - Stores to chrome.storage: currentSession (line 28-36)
│ - Sends response: res.send({ success: true, data: analysis })
└──────┬───────────────────┘
       │
       ▼ Response travels back through same channel
       │
┌──────────────────┐
│ Content Script   │ Returns response (line 162)
└──────┬───────────┘
       │
       ▼ callback from sendMessage resolves
       │
┌─────────────┐
│  Sidepanel  │ 
│ - setAnalysis(response.data) (line 67)
│ - setCurrentStep('analysis') (line 68)
│ - UI re-renders with analysis data
└─────────────┘