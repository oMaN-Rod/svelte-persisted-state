# svelte-persisted-state

Svelte 5 persisted states, [svelte-persisted-store](https://github.com/joshnuss/svelte-persisted-store), but implemented with Svelte 5 Runes.

## Requirements

This package requires Svelte 5. It is not compatible with Svelte 4 or earlier versions.

## Installation

```bash
npm install svelte-persisted-state
```

## API

This package exports two functions:

- `persistedState` - Synchronous storage (localStorage, sessionStorage, cookies)
- `persistedStateAsync` - Asynchronous storage (IndexedDB) for large datasets

### persistedState (Sync)

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

function toggleTheme() {
	userPreferences.current.theme = userPreferences.current.theme === 'light' ? 'dark' : 'light';
}

// Using $derived for reactive computations
const theme = $derived(userPreferences.current.theme);

// The UI will automatically update when the state changes
```

### Custom serialization for complex objects (Maps, Sets, Dates)

JSON can't natively serialize objects like Map, Set, Date, BigInt, or circular references. To persist such values, pass a custom serializer. A simple and reliable option is [devalue](https://github.com/sveltejs/devalue).

Install devalue:

```bash
npm install devalue
```

Use it as the serializer:

```typescript
import { persistedState } from 'svelte-persisted-state';
import * as devalue from 'devalue';

const devalueSerializer = {
	stringify: devalue.stringify,
	parse: devalue.parse
};

// Works with Maps, Sets, Dates, nested structures, etc.
export const complexData = persistedState(
	'complexData',
	{
		name: 'Example',
		created: new Date(),
		nested: {
			array: [1, 2, 3],
			map: new Map([
				['key1', 'value1'],
				['key2', 'value2']
			]),
			set: new Set([1, 2, 3])
		}
	},
	{
		serializer: devalueSerializer
	}
);

// Tip: if you mutate a Map/Set in-place, reassign to trigger reactivity:
// complexData.current.nested.map.set('key3', 'value3');
// complexData.current = { ...complexData.current };
```

### Cookie Storage

You can use cookies for storage, which is useful for SSR scenarios or when you need data to persist across subdomains:

```typescript
import { persistedState } from 'svelte-persisted-state';

const cookieState = persistedState('myCookieKey', 'defaultValue', {
	storage: 'cookie',
	cookieOptions: {
		expireDays: 30 // Custom expiration
	}
});
```

Notes:

- Cookies have a size limit (~4KB per cookie)
- `syncTabs` doesn’t work with cookies
- Cookies are sent with every HTTP request
- Modern browsers cap expiration at about 400 days

### persistedStateAsync (Async)

For large datasets (50MB+) or async usage, use `persistedStateAsync` with IndexedDB:

```typescript
import { persistedStateAsync } from 'svelte-persisted-state';

const largeData = persistedStateAsync('large-dataset', [], {
	indexedDB: {
		dbName: 'my-app', // default: 'svelte-persisted-state'
		storeName: 'state', // default: 'state'
		version: 1 // default: 1
	},
	syncTabs: true, // Uses BroadcastChannel for cross-tab sync
	onHydrated: (value) => console.log('Data loaded:', value.length)
});
```

#### Parameters

- `key`: A string key used for storage
- `initialValue`: The initial value (returned immediately, before hydration)
- `options`: An optional object with the following properties:
  - `indexedDB`: IndexedDB configuration object:
    - `dbName`: Database name (default: 'svelte-persisted-state')
    - `storeName`: Object store name (default: 'state')
    - `version`: Database version (default: 1)
  - `serializer`: Custom serializer with `parse` and `stringify` methods (default: JSON)
  - `syncTabs`: Boolean to sync state across tabs via BroadcastChannel (default: true)
  - `onWriteError`: Function to handle write errors
  - `onParseError`: Function to handle parse errors
  - `onHydrated`: Callback when hydration completes with the loaded value
  - `onHydrationError`: Function to handle hydration errors
  - `beforeRead`: Function to process value before reading
  - `beforeWrite`: Function to process value before writing

#### Return Value

`persistedStateAsync` returns immediately with the initial value and hydrates asynchronously in the background:

```typescript
interface AsyncPersistedState<T> {
	current: T; // Get or set the current value (reactive)
	isLoading: boolean; // True while hydrating from IndexedDB
	ready: Promise<T>; // Resolves when hydration completes
	reset(): void; // Reset to initial value
}
```

#### Automatic Reactivity (Simplest Usage)

Since `current` is reactive (`$state`), the UI automatically updates when hydration completes. **No loading state handling is required** if you're okay with the initial value showing briefly:

```svelte
<script lang="ts">
	import { persistedStateAsync } from 'svelte-persisted-state';

	const notes = persistedStateAsync('notes', []);
</script>

<!-- This automatically updates when data loads from IndexedDB -->
<p>You have {notes.current.length} notes</p>

{#each notes.current as note}
	<div>{note.title}</div>
{/each}

<button onclick={() => notes.current = [...notes.current, { title: 'New' }]}>
	Add Note
</button>
```

#### Optional: Loading States

If you want to show a loading indicator while hydrating, use `isLoading` or `{#await}`:

```svelte
<!-- Using isLoading -->
{#if data.isLoading}
	<Spinner />
{:else}
	<List items={data.current} />
{/if}

<!-- Using {#await} -->
{#await data.ready}
	<p>Loading...</p>
{:then}
	<List items={data.current} />
{:catch error}
	<p>Error: {error.message}</p>
{/await}
```

#### Awaiting in JavaScript

```typescript
const data = persistedStateAsync('my-data', []);

// Optionally wait for hydration
await data.ready;
console.log('Hydrated:', data.current);

// Or capture the hydrated value directly
const value = await data.ready;
console.log('Hydrated:', value);
```

### Type Exports

For TypeScript users, the following types are exported:

```typescript
import type {
	AsyncOptions,
	AsyncPersistedState,
	IndexedDBOptions
} from 'svelte-persisted-state';
```

### Storage Comparison

| Feature            | localStorage                | sessionStorage          | cookies                  | IndexedDB                  |
| ------------------ | --------------------------- | ----------------------- | ------------------------ | -------------------------- |
| **Persistence**    | Until manually cleared      | Until tab/window closes | Until expiration date    | Until manually cleared     |
| **Size Limit**     | ~5-10MB                     | ~5-10MB                 | ~4KB                     | ~50MB+ (browser dependent) |
| **API Type**       | Sync                        | Sync                    | Sync                     | Async                      |
| **Server Access**  | No                          | No                      | Yes (sent with requests) | No                         |
| **Tab Sync**       | Yes (with `syncTabs: true`) | No                      | No                       | Yes (via BroadcastChannel) |
| **SSR Compatible** | No                          | No                      | Yes                      | No                         |
| **Expiration**     | Manual                      | Automatic               | Configurable             | Manual                     |

## Examples

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
