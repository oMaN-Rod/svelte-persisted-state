import { persistedStateAsync } from '$lib/index.svelte.js';

export interface Note {
	id: string;
	title: string;
	content: string;
	createdAt: number;
}

export const notes = persistedStateAsync<Note[]>('notes', [], {
	onHydrated: (value) => console.log('Notes loaded:', value.length),
	onWriteError: (error) => console.error('Failed to save notes:', error)
});

export interface AppSettings {
	autoSave: boolean;
	sortOrder: 'newest' | 'oldest';
	showTimestamps: boolean;
}

export const settings = persistedStateAsync<AppSettings>(
	'app-settings',
	{
		autoSave: true,
		sortOrder: 'newest',
		showTimestamps: true
	},
	{
		syncTabs: true,
		onHydrated: (value) => console.log('Settings loaded:', value)
	}
);
