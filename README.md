# svelte-persisted-state

Svelte 5 persisted states, [svelte-persisted-store](https://github.com/joshnuss/svelte-persisted-store), but implemented with Svelte 5 Runes.

## Requirements

This package requires Svelte 5. It is not compatible with Svelte 4 or earlier versions.

## Installation

```bash
npm install svelte-persisted-state
```

## API

The `persistedState` function creates a persisted state that automatically syncs with local storage, session storage, or browser cookies.

### Parameters

- `key`: A string key used for storage.
- `initialValue`: The initial value of the state.
- `options`: An optional object with the following properties:
  - `storage`: 'local' (default), 'session', or 'cookie'
  - `serializer`: Custom serializer object with `parse` and `stringify` methods (default: JSON)
  - `syncTabs`: Boolean to sync state across tabs (default: true, only works with localStorage)
  - `cookieOptions`: Cookie-specific configuration object (only applies when storage is 'cookie'):
    - `expireDays`: Number of days before cookie expires (default: 365, max: 400 due to browser limits)
    - `maxAge`: Max-Age in seconds (takes precedence over expireDays if both are specified)
    - `path`: Cookie path (default: '/')
    - `domain`: Cookie domain (default: current domain)
    - `secure`: Secure flag - cookie only sent over HTTPS (default: false)
    - `sameSite`: SameSite attribute for CSRF protection - 'Strict' | 'Lax' | 'None' (default: 'Lax')
    - `httpOnly`: HttpOnly flag - prevents client-side script access (default: false)
  - `onWriteError`: Function to handle write errors
  - `onParseError`: Function to handle parse errors
  - `beforeRead`: Function to process value before reading
  - `beforeWrite`: Function to process value before writing

### Return Value

The `persistedState` function returns an object with the following properties:

- `current`: Get or set the current state value.
- `reset()`: Reset the state to its initial value.

## Usage

### Basic Usage

```javascript
import { persistedState } from 'svelte-persisted-state';

const myState = persistedState('myKey', 'initialValue');

// Use myState.current to get or set the state
console.log(myState.current);
myState.current = 'newValue';

// Reset to initial value
myState.reset();
```

### Typed Usage

```typescript
import { persistedState } from 'svelte-persisted-state';

interface UserPreferences {
	theme: 'light' | 'dark';
	fontSize: number;
	notifications: boolean;
}

const userPreferences = persistedState<UserPreferences>(
	'userPreferences',
	{
		theme: 'light',
		fontSize: 16,
		notifications: true
	},
	{
		storage: 'local',
		syncTabs: true,
		beforeWrite: (value) => {
			console.log('Saving preferences:', value);
			return value;
		},
		onWriteError: (error) => {
			console.error('Failed to save preferences:', error);
		}
	}
);

// Set a new value
function toggleTheme() {
	userPreferences.current = {
		...userPreferences.current,
		theme: userPreferences.current.theme === 'light' ? 'dark' : 'light'
	};
}

function toggleTheme() {
	userPreferences.current.theme = userPreferences.current.theme === 'light' ? 'dark' : 'light';
}

// Using $derived for reactive computations
const theme = $derived(userPreferences.current.theme);

// The UI will automatically update when the state changes
```

### Cookie Storage

You can use cookies for storage, which is useful for server-side rendering scenarios or when you need data to persist across different subdomains:

```typescript
import { persistedState } from 'svelte-persisted-state';

// Basic cookie usage (expires after 365 days by default)
const cookieState = persistedState('myCookieKey', 'defaultValue', {
	storage: 'cookie'
});

// Custom cookie expiration (expires after 30 days)
const shortTermCookie = persistedState(
	'tempData',
	{ userId: null },
	{
		storage: 'cookie',
		cookieOptions: {
			expireDays: 30
		}
	}
);

// Long-term cookie (expires after 2 years, most browsers limit to 400 days)
const longTermPrefs = persistedState(
	'userPreferences',
	{ theme: 'light' },
	{
		storage: 'cookie',
		cookieOptions: {
			expireDays: 730
		}
	}
);
```

**Important Notes about Cookie Storage:**

- Cookies have a size limit (typically 4KB per cookie)
- `syncTabs` option doesn't work with cookies (cookies don't trigger storage events)
- Cookies are sent with every HTTP request to your domain
- Cookie expiration can be customized with the `cookieOptions.expireDays` option

#### Browser Limitations

**Important:** Modern browsers enforce a maximum cookie expiration limit:

- **Chrome (since August 2022)** and other modern browsers cap cookie expiration at **400 days maximum**
- Cookies requesting longer expiration are automatically reduced to 400 days
- This limit is part of the updated HTTP cookie specification (RFC 6265bis)

### Storage Comparison

| Feature            | localStorage                | sessionStorage          | cookies                  |
| ------------------ | --------------------------- | ----------------------- | ------------------------ |
| **Persistence**    | Until manually cleared      | Until tab/window closes | Until expiration date    |
| **Size Limit**     | ~5-10MB                     | ~5-10MB                 | ~4KB                     |
| **Server Access**  | No                          | No                      | Yes (sent with requests) |
| **Tab Sync**       | Yes (with `syncTabs: true`) | No                      | No                       |
| **SSR Compatible** | No                          | No                      | Yes                      |
| **Expiration**     | Manual                      | Automatic               | Configurable             |

## Examples

### Different Storage Types

```typescript
// localStorage (default)
const localState = persistedState('local-key', 'value');

// sessionStorage
const sessionState = persistedState('session-key', 'value', {
	storage: 'session'
});
```

### Cookie Configuration

```typescript
// Authentication cookie with security options
const authToken = persistedState('auth-token', null, {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 7, // Weekly re-authentication
		secure: true, // Only send over HTTPS
		sameSite: 'Strict', // Maximum CSRF protection
		path: '/' // Available site-wide
	}
});

// User preferences with balanced security
const userPreferences = persistedState('user-prefs', defaultPrefs, {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 90, // Quarterly preference reset
		secure: true, // HTTPS only
		sameSite: 'Lax', // Balance security and usability
		path: '/' // Available site-wide
	}
});

// Shopping cart for specific site section
const shoppingCart = persistedState('cart', [], {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 14, // Two-week shopping consideration
		path: '/shop', // Only available in shop section
		secure: true, // HTTPS only
		sameSite: 'Lax'
	}
});

// Cross-subdomain application state
const globalState = persistedState('global-user', userData, {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 30,
		domain: '.example.com', // Available across all subdomains
		secure: true, // HTTPS only
		sameSite: 'None', // Required for cross-site cookies
		path: '/'
	}
});

// Using max-age
const maxAgeCookie = persistedState('session-data', sessionData, {
	storage: 'cookie',
	cookieOptions: {
		maxAge: 3600, // 1 hour in seconds
		secure: true,
		sameSite: 'Strict',
		path: '/'
	}
});

// Using expires (expireDays)
const expiresCookie = persistedState('data1', value, {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 30
	}
});
```

### Complete Example

```svelte
<script lang="ts">
	import { persistedState } from 'svelte-persisted-state';

	interface UserPreferences {
		theme: 'light' | 'dark';
		fontSize: number;
	}

	const preferences = persistedState<UserPreferences>('preferences', {
		theme: 'light',
		fontSize: 16
	});

	const theme = $derived(preferences.current.theme);
	const fontSize = $derived(preferences.current.fontSize);
</script>

<div style="font-size: {fontSize}px">
	<button onclick={() => (preferences.current.theme = theme === 'light' ? 'dark' : 'light')}>
		Switch to {theme === 'light' ? 'dark' : 'light'} theme
	</button>
	<button onclick={() => (preferences.current.fontSize -= 1)}> Decrease font size </button>
	<button onclick={() => (preferences.current.fontSize += 1)}> Increase font size </button>
	<p>Current theme: {theme}</p>
	<p>Current font size: {fontSize}px</p>
</div>
```

### Cookie Storage Example

```svelte
<script lang="ts">
	import { persistedState } from 'svelte-persisted-state';
	// User session data stored in cookies (expires in 30 days)
	const userSession = persistedState(
		'user-session',
		{
			isLoggedIn: false,
			username: ''
		},
		{
			storage: 'cookie',
			cookieOptions: {
				expireDays: 30
			}
		}
	);

	// Shopping cart stored in cookies (expires in 7 days)
	const cart = persistedState('shopping-cart', [], {
		storage: 'cookie',
		cookieOptions: {
			expireDays: 7
		}
	});

	function login(username: string) {
		userSession.current = { isLoggedIn: true, username };
	}

	function logout() {
		userSession.current = { isLoggedIn: false, username: '' };
	}
</script>

{#if userSession.current.isLoggedIn}
	<p>Welcome back, {userSession.current.username}!</p>
	<button onclick={logout}>Logout</button>
{:else}
	<button onclick={() => login('demo-user')}>Login as Demo User</button>
{/if}

<p>Cart items: {cart.current.length}</p>
```

## License

MIT
