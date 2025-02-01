<script lang="ts">
	import { persistedState } from '$lib/index.svelte.js';

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
