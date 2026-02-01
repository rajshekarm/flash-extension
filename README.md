# Flash Chrome Extension ⚡

Chrome Extension for AI-powered job application assistance using Plasmo framework.

## Overview

Flash Extension integrates with the [Atlas Flash Service](../atlas/app/services/flash/) to provide intelligent job application assistance directly in your browser.

**Key Features**:
- 🎯 Detect job application forms automatically
- 📝 Extract job descriptions from postings
- ✨ Auto-fill forms with AI-generated answers
- 📊 Show confidence scores for each answer
- 👁️ Review and edit before submission
- 🛡️ Ethical guardrails (no fake experience)

## Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-dev/` directory

### Prerequisites

- Node.js 18.0 or higher
- pnpm (recommended) or npm
- Chrome browser
- Atlas Flash backend running at `http://localhost:8000`

---

## Tech Stack

- **Framework**: [Plasmo](https://www.plasmo.com/) - Modern browser extension framework
- **UI**: React + TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context / Zustand
- **API**: Axios for Atlas backend communication
- **Storage**: Chrome Storage API

---

## Project Structure

```
flash-extension/
├── src/
│   ├── background/              # Service worker
│   │   ├── index.ts             # Background script entry
│   │   └── messages/            # Message handlers
│   │       ├── analyzeJob.ts
│   │       ├── fillForm.ts
│   │       └── tailorResume.ts
│   │
│   ├── content/                 # Content scripts
│   │   ├── index.tsx            # Main content script
│   │   ├── detector.ts          # Form field detection
│   │   ├── extractor.ts         # Job description extraction
│   │   └── injector.ts          # Answer injection
│   │
│   ├── popup/                   # Extension popup
│   │   ├── index.tsx            # Popup entry
│   │   ├── components/
│   │   │   ├── JobAnalysis.tsx
│   │   │   ├── FormReview.tsx
│   │   │   ├── AnswerCard.tsx
│   │   │   └── ConfidenceScore.tsx
│   │   └── store/
│   │       └── appStore.ts
│   │
│   ├── sidepanel/               # Side panel UI
│   │   ├── index.tsx
│   │   └── components/
│   │       ├── ApplicationFlow.tsx
│   │       ├── ResumePreview.tsx
│   │       └── AnswerList.tsx
│   │
│   ├── options/                 # Settings page
│   │   ├── index.tsx
│   │   └── components/
│   │       ├── ProfileForm.tsx
│   │       ├── ApiSettings.tsx
│   │       └── PreferencesForm.tsx
│   │
│   ├── components/              # Shared components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Spinner.tsx
│   │
│   ├── lib/                     # Utilities
│   │   ├── api/
│   │   │   ├── client.ts        # API client
│   │   │   ├── flash.ts         # Flash service endpoints
│   │   │   └── types.ts         # API types
│   │   ├── dom/
│   │   │   ├── formDetector.ts  # Detect form fields
│   │   │   ├── jobExtractor.ts  # Extract job descriptions
│   │   │   └── fieldInjector.ts # Inject answers
│   │   ├── storage/
│   │   │   └── chrome.ts        # Chrome storage wrapper
│   │   └── utils/
│   │       ├── validators.ts
│   │       └── formatters.ts
│   │
│   ├── types/                   # TypeScript types
│   │   ├── flash.ts
│   │   ├── form.ts
│   │   └── chrome.ts
│   │
│   └── assets/                  # Static assets
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── .plasmo/                     # Plasmo build artifacts
├── build/                       # Extension build output
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── plasmo.config.ts             # Plasmo configuration
├── .env.example
└── README.md
```

---

## Why Plasmo?

### Advantages
- ✅ **React + TypeScript** - Modern DX out of the box
- ✅ **Hot Module Reload** - Fast development iteration
- ✅ **Automatic manifest** - No manual manifest.json management
- ✅ **Content script injection** - Simplified compared to vanilla Chrome API
- ✅ **Built-in bundling** - Uses Parcel under the hood
- ✅ **Multi-browser support** - Chrome, Firefox, Edge, etc.

### Perfect for Flash
- Works great with React components
- Easy API communication with Atlas backend
- Simplified message passing between scripts
- Good TypeScript support
- Active community and documentation

---

## Project Location: OUTSIDE Atlas

### Recommendation: Separate Repository

**Create at**: `flash-extension/` (sibling to `atlas/`)

```
personal-workspace/
├── atlas/                    # Python backend
│   └── app/services/flash/
└── flash-extension/          # Chrome Extension (this project)
    └── src/
```

### Why Outside Atlas?

1. **Different Tech Stack**
   - Atlas: Python, FastAPI
   - Extension: TypeScript, React, Node.js
   - Separate `package.json` vs `requirements.txt`

2. **Independent Development**
   - Extension can be developed/deployed independently
   - Different release cycles
   - Separate CI/CD pipelines

3. **Build Systems**
   - Atlas: No build step (Python)
   - Extension: Plasmo build process
   - Avoid mixing build artifacts

4. **Deployment**
   - Atlas: Azure/server
   - Extension: Chrome Web Store
   - Completely different deployment processes

5. **Version Control**
   - Can have separate Git repos if needed
   - Independent versioning (extension v1.2 != backend v2.3)

### Connection to Atlas

**Link via API**:
```typescript
// flash-extension/src/lib/api/client.ts
const API_BASE = process.env.PLASMO_PUBLIC_API_URL || "http://localhost:8000"

export const flashApi = {
  analyzeJob: (data) => axios.post(`${API_BASE}/api/flash/analyze-job`, data),
  fillApplication: (data) => axios.post(`${API_BASE}/api/flash/fill-application`, data),
  // ...
}
```

**Documentation link**:
```markdown
# In flash-extension/README.md
Backend API: [Atlas Flash Service](../atlas/app/services/flash/README.md)
```

---

## Core Requirements

### 1. User Authentication & Profile
- [ ] User login/registration (OAuth or API key)
- [ ] Profile setup (name, email, experience, skills)
- [ ] Resume upload and storage
- [ ] Preferences configuration

### 2. Job Detection & Analysis
- [ ] Detect when user is on a job posting page
- [ ] Extract job description from various job boards
  - LinkedIn
  - Indeed
  - Greenhouse
  - Lever
  - Company career pages
- [ ] Trigger job analysis API call
- [ ] Display analysis results (required skills, match score)

### 3. Form Field Detection
- [ ] Detect application form fields on page
- [ ] Identify field types (text, textarea, dropdown, radio, etc.)
- [ ] Extract field labels and requirements
- [ ] Handle multi-step forms
- [ ] Support common job board platforms

### 4. AI-Powered Auto-Fill
- [ ] Send form fields to Flash API
- [ ] Receive AI-generated answers
- [ ] Display confidence scores
- [ ] Allow user review and editing
- [ ] Inject approved answers into form
- [ ] Handle file uploads (resume PDF)

### 5. Resume Tailoring
- [ ] Trigger resume tailoring for specific job
- [ ] Show diff preview of changes
- [ ] Allow user to approve/reject changes
- [ ] Download tailored resume
- [ ] Store tailored versions

### 6. UI Components

#### Popup (Quick Access)
- [ ] Current page status (job detected? form detected?)
- [ ] Quick actions (analyze job, fill form)
- [ ] Recent applications
- [ ] Settings link

#### Side Panel (Main Workflow)
- [ ] Job analysis view
- [ ] Form fields list with answers
- [ ] Confidence indicators
- [ ] Answer editing interface
- [ ] Resume preview
- [ ] Submission confirmation

#### Options Page (Settings)
- [ ] User profile form
- [ ] API endpoint configuration
- [ ] Preferences (auto-analyze, confidence threshold)
- [ ] Application history
- [ ] API key management

### 7. Data Management
- [ ] Store user profile in Chrome storage
- [ ] Cache job analyses
- [ ] Save draft applications
- [ ] Track application history
- [ ] Sync with backend (optional)

### 8. Safety & Ethics
- [ ] Show confidence scores prominently
- [ ] Require user review before submission
- [ ] Never auto-submit without approval
- [ ] Display data source for each answer
- [ ] Allow easy editing of AI suggestions
- [ ] No CAPTCHA bypass attempts

### 9. Error Handling
- [ ] Handle API failures gracefully
- [ ] Offline mode with cached data
- [ ] Form detection failures
- [ ] Invalid field type handling
- [ ] Network retry logic

### 10. Performance
- [ ] Lazy load content scripts
- [ ] Debounce form detection
- [ ] Cache API responses
- [ ] Optimize bundle size
- [ ] Minimize DOM manipulation

---

## API Integration

### Atlas Flash Service Endpoints

```typescript
// Job Analysis
POST /api/flash/analyze-job
{
  job_description: {
    title: string,
    company: string,
    description: string,
    url: string
  }
}

// Resume Tailoring
POST /api/flash/tailor-resume
{
  job_id: string,
  user_id: string
}

// Answer Question
POST /api/flash/answer-question
{
  question_context: {
    question: string,
    field_id: string,
    field_type: string,
    job_id: string
  },
  user_id: string
}

// Fill Application
POST /api/flash/fill-application
{
  application_form: {
    form_id: string,
    url: string,
    job_id: string,
    fields: Array<FormField>
  },
  job_description: JobDescription,
  user_id: string
}

// Approve Application
POST /api/flash/approve-application
{
  application_id: string,
  user_id: string,
  edited_fields?: Array<FilledField>
}

// User Profile
GET /api/flash/profile/{user_id}
POST /api/flash/profile
```

---

## Development Workflow

### Phase 1: Setup & Foundation
1. Initialize Plasmo project
2. Set up TypeScript + React
3. Configure Tailwind CSS
4. Create basic popup UI
5. Test extension loading

### Phase 2: Core Detection
1. Content script for form detection
2. Job description extraction
3. Field type identification
4. Test on major job boards

### Phase 3: API Integration
1. API client setup
2. Connect to Flash backend
3. Handle authentication
4. Test API calls

### Phase 4: UI Components
1. Side panel interface
2. Answer review cards
3. Confidence indicators
4. Edit functionality

### Phase 5: Auto-Fill Logic
1. Answer injection
2. Field mapping
3. Multi-step form handling
4. Validation

### Phase 6: Polish
1. Error handling
2. Loading states
3. Animations
4. Accessibility
5. Testing

---

## Browser Compatibility

**Primary Target**: Chrome (Manifest V3)

**Future Support**:
- Edge (Chromium) - Should work out of the box
- Firefox - Requires Plasmo config adjustment
- Safari - May need separate build

---

## Security Considerations

### Data Handling
- Store minimal data locally
- Encrypt sensitive info (API keys)
- Clear cache on logout
- No credential auto-fill

### API Communication
- Use HTTPS only
- Implement request signing
- Rate limiting on client side
- Token expiration handling

### Permissions
Request only necessary permissions:
- `activeTab` - Current tab access
- `storage` - Local data storage
- `sidePanel` - Side panel UI
- `scripting` - Content script injection
- Host permissions for specific job sites

---

## Testing Strategy

### Unit Tests
- Form field detection logic
- Job description extraction
- API client functions
- Utility functions

### Integration Tests
- API communication
- Chrome storage operations
- Message passing between scripts

### E2E Tests (Playwright)
- Full application flow on real job sites
- Multi-step form handling
- Error scenarios

### Manual Testing
- Test on top 10 job boards
- Various form types
- Edge cases (unusual fields)

---

## Deployment

### Development
```bash
npm run dev
# Load unpacked extension from build/ folder
```

### Production
```bash
npm run build
# Submit build/chrome-mv3-prod to Chrome Web Store
```

### Distribution
1. Chrome Web Store (primary)
2. Direct download (.crx file) for beta testing
3. Enterprise deployment (for companies)

---

## Maintenance

### Updates
- Monitor Chrome API changes
- Update dependencies regularly
- Track Plasmo framework updates
- Test on Chrome Canary

### Support
- User feedback collection
- Bug tracking (GitHub Issues)
- Feature requests
- Analytics (privacy-focused)

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Chrome browser
- Atlas backend running locally

### Installation

```bash
# Navigate to project
cd flash-extension

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your Atlas API URL

# Start development
pnpm dev

# Load extension
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the build/chrome-mv3-dev folder
```

---

## Project Timeline

### Week 1-2: Setup & Planning
- [ ] Initialize Plasmo project
- [ ] Set up development environment
- [ ] Create basic UI mockups
- [ ] Design component architecture

### Week 3-4: Core Features
- [ ] Form detection system
- [ ] Job extraction logic
- [ ] API integration
- [ ] Basic auto-fill

### Week 5-6: UI Development
- [ ] Side panel interface
- [ ] Review workflow
- [ ] Settings page
- [ ] Polish and refinement

### Week 7-8: Testing & Launch
- [ ] E2E testing
- [ ] Bug fixes
- [ ] Documentation
- [ ] Beta release

---

## Resources

### Plasmo Documentation
- [Plasmo Docs](https://docs.plasmo.com/)
- [Plasmo Examples](https://github.com/PlasmoHQ/examples)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)

### Related Projects
- [Atlas Flash Service](../atlas/app/services/flash/README.md)
- [Flash API Documentation](../atlas/app/services/flash/API_DOCS.md)

---

## License

Same as Atlas backend - Personal project

---

## Contact

For questions or collaboration: [Your contact]

**Backend**: [Atlas Repository](../atlas)  
**API**: http://localhost:8000/docs (when running locally)
