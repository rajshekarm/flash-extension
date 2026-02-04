# Flash Extension - AI Agent Instructions

## Project Overview
Flash is a Chrome Extension built with **Plasmo** that provides AI-powered job application assistance. It detects job boards, extracts job information, and auto-fills application forms using the Atlas Flash backend service (FastAPI + Azure OpenAI).

**Key Architecture**: Plasmo-based Chrome Extension with React UI, communicating with Atlas backend via Background Service Worker.

## Critical Patterns

### Plasmo Framework Conventions
- **Content Scripts**: Use `export const config: PlasmoCSConfig` for injection rules. File pattern: `src/content/*.content.ts` or `src/content/*.tsx`
- **Background Messages**: Create message handlers in `src/background/messages/`. Each exports `PlasmoMessaging.MessageHandler` with async handler
- **UI Pages**: Popup (`src/popup/`), Side Panel (`src/sidepanel/`), Options (`src/options/`) are React entry points with `index.tsx`
- **Builds**: `pnpm dev` → `build/chrome-mv3-dev/`, `pnpm build` → `build/chrome-mv3-prod/`

### Message Flow Architecture
```
UI Component → sendToBackground() → Background Message Handler → FlashAPI → Atlas Backend
```
**Example**: [src/background/messages/analyzeJob.ts](src/background/messages/analyzeJob.ts) shows the pattern:
```typescript
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const analysis = await flashAPI.analyzeJob(jobDescription, userId);
  res.send({ success: true, data: analysis });
};
export default handler;
```

### Storage Pattern
- Use `@plasmohq/storage` wrappers: `flashStorage` (local) and `flashSyncStorage` (sync)
- Defined in [src/lib/storage/chrome.ts](src/lib/storage/chrome.ts)
- Session state stored as `currentSession`, user profile as `userProfile`

### DOM Interaction Strategy
- **Form Detection**: [src/lib/dom/formDetector.ts](src/lib/dom/formDetector.ts) uses scoring algorithm (0-1) to identify application forms
- **Job Extraction**: [src/lib/dom/jobExtractor.ts](src/lib/dom/jobExtractor.ts) contains platform-specific selectors (LinkedIn, Workday, Greenhouse)
- **Field Injection**: [src/lib/dom/fieldInjector.ts](src/lib/dom/fieldInjector.ts) injects answers and triggers native events

### Type System
- Backend contract types in [src/types/flash.ts](src/types/flash.ts) (matches Atlas backend models)
- Chrome extension types in [src/types/chrome.ts](src/types/chrome.ts)
- Form/DOM types in [src/types/form.ts](src/types/form.ts)

## Development Workflow

### Essential Commands
```bash
pnpm dev              # Hot-reload dev build (loads in chrome://extensions/)
pnpm build            # Production build
pnpm package          # Create distributable .zip
pnpm type-check       # Verify TypeScript types
```

### Testing Content Scripts
- Content scripts inject on matched URLs defined in `PlasmoCSConfig.matches`
- Currently [src/content/job-board.content.ts](src/content/job-board.content.ts) is a minimal test - check console for "🔥 Flash Injected"
- For debugging: Chrome DevTools → Sources → Content Scripts

### Backend Integration
- Backend URL configured in `.env` as `PLASMO_PUBLIC_API_URL`
- API client: [src/lib/api/client.ts](src/lib/api/client.ts) (Axios with retry logic)
- Flash service methods: [src/lib/api/flash.ts](src/lib/api/flash.ts)
- Endpoints: `/api/flash/analyze-job`, `/api/flash/tailor-resume`, `/api/flash/fill-application`

## Project-Specific Conventions

### File Organization
- Background message handlers named by action: `analyzeJob.ts`, `fillApplication.ts`
- DOM utilities grouped by responsibility: `formDetector.ts`, `jobExtractor.ts`, `fieldInjector.ts`
- API layer separated: `client.ts` (generic HTTP), `flash.ts` (Flash-specific methods)

### Error Handling
- Background message handlers wrap in try-catch, return `{ success: false, error: message }`
- API client has retry logic with exponential backoff ([src/lib/api/client.ts](src/lib/api/client.ts))
- Content scripts log errors but don't block page interaction

### Platform Detection
- Job board patterns defined in [src/lib/dom/jobExtractor.ts](src/lib/dom/jobExtractor.ts) with domain matchers
- Workday uses `data-automation-id` selectors, LinkedIn uses class-based selectors
- Form scoring heuristics: keywords ("apply", "resume"), file inputs, textareas ([src/lib/dom/formDetector.ts](src/lib/dom/formDetector.ts))

## Important Files & References

### Architecture Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design, component boundaries, data flows
- [docs/WORKFLOW.md](docs/WORKFLOW.md) - Step-by-step execution traces for key user flows
- [docs/DESIGN.md](docs/DESIGN.md) - UI/UX specs, user flows
- [docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md) - Feature checklist, setup guide

### Key Entry Points
- [src/background/index.ts](src/background/index.ts) - Background service worker, handles lifecycle, tab detection, context menus
- [src/content/job-board.content.ts](src/content/job-board.content.ts) - Main content script (currently minimal)
- [src/popup/index.tsx](src/popup/index.tsx) - Popup UI entry
- [src/sidepanel/index.tsx](src/sidepanel/index.tsx) - Side panel UI entry

### Shared Components
- [src/components/](src/components/) - Reusable React components (Button, Card, Spinner, ConfidenceScore, Input)
- Styled with **Tailwind CSS** - config in [tailwind.config.js](tailwind.config.js)

## Common Tasks

### Adding a New Message Handler
1. Create `src/background/messages/yourAction.ts`
2. Export `PlasmoMessaging.MessageHandler` with async handler
3. Call from UI: `sendToBackground({ name: "yourAction", body: { ... } })`

### Adding Job Board Support
1. Update [src/lib/dom/jobExtractor.ts](src/lib/dom/jobExtractor.ts) with platform pattern (domain, selectors)
2. Add URL match in [src/content/job-board.content.ts](src/content/job-board.content.ts) `config.matches`

### Debugging Extension
- **Background**: `chrome://extensions/` → "service worker" link → DevTools
- **Content**: Right-click page → Inspect → Console (filter by content script)
- **Popup/Panel**: Right-click extension icon → Inspect

## Gotchas & Quirks
- Plasmo auto-generates manifest from code annotations - don't manually edit `build/**/manifest.json`
- Background service worker is **not persistent** (Manifest V3) - design for stateless operation
- Content scripts can't make API calls directly - must message background worker
- `@plasmohq/messaging` uses special naming: file `messages/foo.ts` → call with `name: "foo"`
