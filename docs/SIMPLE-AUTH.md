# Simple Auth Flow

This is a simplified, clean authentication system for the Flash extension.

## Architecture Overview

```
UI Components → Storage Functions → Background Messages → Flash API → Backend
```

## Key Files

### 1. UI Components
- `RegisterForm.tsx` - Simple registration form with basic validation
- `LoginForm.tsx` - Simple login form

### 2. Storage Layer (`src/lib/storage/chrome.ts`)
- `login(email, password)` - Calls backend via messages
- `register(name, email, password, confirmPassword)` - Calls backend via messages
- `logout()` - Clears stored auth data
- `checkAuth()` - Verifies authentication status

### 3. Background Messages (`src/background/messages/`)
- `login.ts` - Handles login requests
- `register.ts` - Handles registration requests
- `logout.ts` - Handles logout
- `checkAuth.ts` - Verifies auth status

### 4. API Layer (`src/lib/api/flash.ts`)
- `flashAPI.login()` - POST to `/api/flash/auth/login`
- `flashAPI.register()` - POST to `/api/flash/auth/register`
- `flashAPI.logout()` - POST to `/api/flash/auth/logout`

## Simple Flow

### Registration Flow
1. User fills out `RegisterForm`
2. Form calls `register()` from storage
3. Storage calls background message `register`
4. Background calls `flashAPI.register()`
5. API makes HTTP request to backend
6. Success: Store auth token and user data
7. Error: Return simple error message

### Login Flow
1. User fills out `LoginForm` 
2. Form calls `login()` from storage
3. Storage calls background message `login`
4. Background calls `flashAPI.login()`
5. API makes HTTP request to backend
6. Success: Store auth token and user data
7. Error: Return simple error message

## Error Handling

Simple error classification:
- **Email already registered**: Show "Switch to Login" button
- **Invalid credentials**: Show "Invalid email or password"  
- **Network errors**: Show "Check connection"
- **Other errors**: Show the actual error message

## Storage Data

```typescript
{
  authSession: {
    user: { id, name, email },
    access_token: string,
    expires_at: string
  },
  authToken: string,
  refreshToken?: string
}
```

## No Complex Features

- ✅ Simple error messages
- ✅ Basic validation
- ✅ Clean async/await
- ❌ No complex error parsing
- ❌ No timeout wrappers  
- ❌ No retry logic
- ❌ No fallback mechanisms