# svelte-persisted-state

Svelte 5 persisted states, [svelte-persisted-store](https://github.com/joshnuss/svelte-persisted-store), but implemented with Svelte 5 Runes.

## Requirements

This package requires Svelte 5. It is not compatible with Svelte 4 or earlier versions.

## Installation

```bash
npm install svelte-persisted-state
```

## API

The `persistedState` function creates a persisted state that automatically syncs with local or session storage.

### Parameters

- `key`: A string key used for storage.
- `initialValue`: The initial value of the state.
- `options`: An optional object with the following properties:
  - `storage`: 'local' (default) or 'session'
  - `serializer`: Custom serializer object with `parse` and `stringify` methods
  - `syncTabs`: Boolean to sync state across tabs (default: true)
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

## Example

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

## License

MIT
