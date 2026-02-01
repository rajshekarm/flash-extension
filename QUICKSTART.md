# Flash Extension - Quick Start Guide

## Prerequisites

- **Node.js**: 18.0 or higher ([Download](https://nodejs.org/))
- **pnpm**: Package manager ([Install](https://pnpm.io/installation))
- **Chrome**: Latest version
- **Atlas Backend**: Running locally at `http://localhost:8000`

---

## Setup Steps

### 1. Initialize Plasmo Project

```bash
# Navigate to the extension directory
cd flash-extension

# Initialize Plasmo project with TypeScript + React
pnpm create plasmo --with-src

# Or use npx if you prefer npm
npx plasmo init

# Follow prompts:
# - Project name: flash-extension
# - Template: TypeScript + React
# - Package manager: pnpm
```

### 2. Install Dependencies

```bash
# Core dependencies
pnpm add react react-dom
pnpm add @plasmohq/messaging @plasmohq/storage
pnpm add axios zustand

# UI dependencies
pnpm add -D tailwindcss postcss autoprefixer
pnpm add lucide-react  # Icons

# Dev dependencies
pnpm add -D @types/react @types/react-dom
pnpm add -D @types/chrome
pnpm add -D prettier
pnpm add -D vitest @vitest/ui
pnpm add -D @playwright/test
```

### 3. Configure Tailwind CSS

```bash
# Initialize Tailwind
pnpm tailwindcss init -p
```

**Edit `tailwind.config.js`**:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      }
    },
  },
  plugins: [],
}
```

### 4. Set Up Environment Variables

```bash
# Copy example env file
cp .env.example .env
```

**Edit `.env`**:
```bash
PLASMO_PUBLIC_API_URL=http://localhost:8000
PLASMO_PUBLIC_API_KEY=your-api-key-here
```

### 5. Project Structure Setup

```bash
# Create directory structure
mkdir -p src/{background,content,popup,sidepanel,options,components,lib,types,assets}
mkdir -p src/lib/{api,dom,storage,utils}
mkdir -p src/background/messages
mkdir -p src/popup/components
mkdir -p src/sidepanel/components
```

### 6. Configure Plasmo

Create `plasmo.config.ts`:

```typescript
import { PlasmoConfig } from "plasmo"

const config: PlasmoConfig = {
  manifest: {
    name: "Flash - AI Job Application Assistant",
    version: "0.1.0",
    description: "AI-powered job application assistant with ethical auto-fill",
    permissions: [
      "activeTab",
      "storage",
      "sidePanel",
      "scripting"
    ],
    host_permissions: [
      "https://www.linkedin.com/*",
      "https://www.indeed.com/*",
      "https://jobs.lever.co/*",
      "https://boards.greenhouse.io/*",
      "https://*.workday.com/*"
    ],
    action: {
      default_title: "Flash Assistant"
    },
    side_panel: {
      default_path: "sidepanel.html"
    }
  }
}

export default config
```

---

## Development

### Start Development Server

```bash
pnpm dev

# Extension will be built to: build/chrome-mv3-dev/
```

### Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `build/chrome-mv3-dev` folder
5. Extension should now appear in your extensions list

### Hot Reload

Plasmo automatically rebuilds when you save files. Just refresh the page or reopen the popup to see changes.

---

## Build for Production

```bash
# Build optimized production bundle
pnpm build

# Output: build/chrome-mv3-prod/

# Create ZIP for Chrome Web Store submission
cd build/chrome-mv3-prod
zip -r ../../flash-extension.zip .
```

---

## Testing

### Unit Tests

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### E2E Tests

```bash
# Install Playwright
pnpm playwright install

# Run E2E tests
pnpm test:e2e

# Run in UI mode
pnpm playwright test --ui
```

---

## Debugging

### Console Logs

- **Background Script**: `chrome://extensions` → Find extension → "service worker" → Click "inspect"
- **Content Script**: Right-click page → Inspect → Console (filter by extension ID)
- **Popup**: Right-click extension icon → Inspect popup
- **Side Panel**: Open side panel → Right-click → Inspect

### Chrome DevTools

All extension pages can be debugged with Chrome DevTools:
- Set breakpoints in source code
- Inspect network requests
- View storage (chrome.storage)
- Monitor performance

---

## Common Issues

### Extension Won't Load
- Verify `manifest.json` is valid
- Check for TypeScript/build errors
- Try reloading the extension
- Clear browser cache

### Content Script Not Injecting
- Verify `host_permissions` in manifest
- Check URL pattern matching
- Ensure content script is registered
- Look for errors in console

### API Calls Failing
- Verify Atlas backend is running
- Check CORS configuration
- Verify API URL in `.env`
- Check network tab for errors

### Hot Reload Not Working
- Restart `pnpm dev`
- Hard refresh the page (Ctrl+Shift+R)
- Reload extension manually

---

## Useful Commands

```bash
# Development
pnpm dev                 # Start dev server
pnpm build              # Build for production
pnpm clean              # Clean build artifacts

# Testing
pnpm test               # Run unit tests
pnpm test:e2e          # Run E2E tests
pnpm lint              # Lint code
pnpm format            # Format code with Prettier

# Package
pnpm package           # Create ZIP for Chrome Web Store
```

---

## Next Steps

1. **Set up basic popup UI** - Start with a simple React component
2. **Create API client** - Connect to Atlas Flash backend
3. **Implement form detection** - Content script to detect forms
4. **Build side panel** - Main workflow interface
5. **Add error handling** - Graceful degradation
6. **Test on real job sites** - LinkedIn, Indeed, etc.

---

## Resources

### Documentation
- [Plasmo Docs](https://docs.plasmo.com/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/)
- [React Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

### Examples
- [Plasmo Examples](https://github.com/PlasmoHQ/examples)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)

### Backend
- [Atlas Flash Service](../atlas/app/services/flash/README.md)
- [Flash API Docs](../atlas/app/services/flash/API_DOCS.md)

---

## Support

For questions or issues:
- Check [DESIGN.md](./DESIGN.md) for architecture details
- Review [README.md](./README.md) for project overview
- Reference Atlas backend documentation

---

**Ready to start building!** 🚀

Run `pnpm dev` and start with creating the popup UI in `src/popup/index.tsx`.
