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
