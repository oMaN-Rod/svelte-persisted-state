# svelte-persisted-state

Svelte 5 persisted states, [svelte-persisted-store](https://github.com/joshnuss/svelte-persisted-store), but implemented with Svelte 5 Runes.

## Requirements

This package requires Svelte 5. It is not compatible with Svelte 4 or earlier versions.

## Installation

```bash
npm install svelte-persisted-state
```

## Usage

### Basic Usage

```javascript
import { persistedState } from 'svelte-persisted-state';

const myState = persistedState('myKey', 'initialValue');

// Use myState.value to get or set the state
console.log(myState.value);
myState.value = 'newValue';

// Reset to initial value
myState.reset();
```

### Typed Example

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

// Usage in a Svelte component
function toggleTheme() {
    userPreferences.value = {
        ...userPreferences.value,
        theme: userPreferences.value.theme === 'light' ? 'dark' : 'light'
    };
}

// This is also valid
function toggleTheme() {
    userPreferences.value.theme = userPreferences.value.theme === 'light' ? 'dark' : 'light'
}

// Using $derived for reactive computations
const theme = $derived(userPreferences.value.theme);

// The UI will automatically update when the state changes
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

- `value`: Get or set the current state value.
- `reset()`: Reset the state to its initial value.

## Examples with Svelte 5 Components

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

    const theme = $derived(preferences.value.theme);
    const fontSize = $derived(preferences.value.fontSize);

    function toggleTheme() {
        preferences.value = {
            ...preferences.value,
            theme: theme === 'light' ? 'dark' : 'light'
        };
    }

    function decreaseFontSize() {
        preferences.value = {
            ...preferences.value,
            fontSize: fontSize - 1
        };
    }

    function increaseFontSize() {
        preferences.value = {
            ...preferences.value,
            fontSize: fontSize + 1
        };
    }
</script>

<div style="font-size: {fontSize}px">
    <button onclick={toggleTheme}>
        Switch to {theme === 'light' ? 'dark' : 'light'} theme
    </button>
    <button onclick={decreaseFontSize}> Decrease font size </button>
    <button onclick={increaseFontSize}> Increase font size </button>
    <p>Current theme: {theme}</p>
    <p>Current font size: {fontSize}px</p>
</div>
```

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

    const theme = $derived(preferences.value.theme);
    const fontSize = $derived(preferences.value.fontSize);
</script>

<div style="font-size: {fontSize}px">
    <button onclick={() => (preferences.value.theme = theme === 'light' ? 'dark' : 'light')}>
        Switch to {theme === 'light' ? 'dark' : 'light'} theme
    </button>
    <button onclick={() => (preferences.value.fontSize = fontSize - 1)}> Decrease font size </button>
    <button onclick={() => (preferences.value.fontSize = fontSize + 1)}> Increase font size </button>
    <p>Current theme: {theme}</p>
    <p>Current font size: {fontSize}px</p>
</div>
```

## License

MIT
