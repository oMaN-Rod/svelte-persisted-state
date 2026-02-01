<script lang="ts">
	import { notes, settings, type Note } from './states.svelte.js';

	let newTitle = $state('');
	let newContent = $state('');

	const sortedNotes = $derived(() => {
		const sorted = [...notes.current];
		if (settings.current.sortOrder === 'newest') {
			sorted.sort((a, b) => b.createdAt - a.createdAt);
		} else {
			sorted.sort((a, b) => a.createdAt - b.createdAt);
		}
		return sorted;
	});

	function addNote() {
		if (!newTitle.trim()) return;

		const note: Note = {
			id: crypto.randomUUID(),
			title: newTitle.trim(),
			content: newContent.trim(),
			createdAt: Date.now()
		};

		notes.current = [...notes.current, note];
		newTitle = '';
		newContent = '';
	}

	function deleteNote(id: string) {
		notes.current = notes.current.filter((n) => n.id !== id);
	}

	function clearAllNotes() {
		notes.current = [];
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}
</script>

<main class="container">
	<h1>IndexedDB Storage Demo</h1>
	<p class="intro">
		This demo uses <code>persistedStateAsync</code> to store data in IndexedDB. Data persists across
		browser sessions and syncs across tabs via BroadcastChannel.
	</p>

	<a href="/" class="back-link">← Back to main demo</a>

	<div class="section settings-section">
		<h2>Settings - Using {'{#await}'}</h2>
		<p class="section-description">
			This section uses <code>{'{#await}'}</code> to show a loading state (optional pattern).
		</p>

		{#await settings.ready}
			<div class="loading">Loading settings...</div>
		{:then}
			<div class="controls">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={settings.current.autoSave} />
					Auto-save enabled
				</label>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={settings.current.showTimestamps} />
					Show timestamps
				</label>
				<label class="select-label">
					Sort order:
					<select bind:value={settings.current.sortOrder}>
						<option value="newest">Newest first</option>
						<option value="oldest">Oldest first</option>
					</select>
				</label>
				<button onclick={settings.reset} class="reset-btn">Reset Settings</button>
			</div>
		{:catch error}
			<div class="error">Failed to load settings: {error.message}</div>
		{/await}
	</div>

	<div class="section notes-section">
		<h2>Notes - Using isLoading</h2>
		<p class="section-description">
			This section uses <code>isLoading</code> for a loading spinner (optional pattern).
		</p>

		{#if notes.isLoading}
			<div class="loading">
				<div class="spinner"></div>
				Loading notes from IndexedDB...
			</div>
		{:else}
			<div class="add-note-form">
				<input type="text" placeholder="Note title" bind:value={newTitle} class="title-input" />
				<textarea
					placeholder="Note content (optional)"
					bind:value={newContent}
					class="content-input"
				></textarea>
				<div class="form-actions">
					<button onclick={addNote} class="add-btn" disabled={!newTitle.trim()}>Add Note</button>
					<button onclick={clearAllNotes} class="clear-btn" disabled={notes.current.length === 0}>
						Clear All ({notes.current.length})
					</button>
				</div>
			</div>

			<div class="notes-list">
				{#if sortedNotes().length === 0}
					<p class="empty">No notes yet. Add your first note above!</p>
				{:else}
					{#each sortedNotes() as note (note.id)}
						<div class="note-card">
							<div class="note-header">
								<h3 class="note-title">{note.title}</h3>
								<button onclick={() => deleteNote(note.id)} class="delete-btn" title="Delete note">
									×
								</button>
							</div>
							{#if note.content}
								<p class="note-content">{note.content}</p>
							{/if}
							{#if settings.current.showTimestamps}
								<span class="note-date">{formatDate(note.createdAt)}</span>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<div class="section info-section">
		<h2>How It Works</h2>
		<div class="info-content">
			<div class="info-item">
				<h3>Automatic Reactivity</h3>
				<p>
					<code>current</code> is reactive - the UI updates automatically when data loads from IndexedDB.
					No loading state handling required!
				</p>
			</div>
			<div class="info-item">
				<h3>Optional Loading States</h3>
				<p>
					Use <code>isLoading</code> or <code>{'{#await ready}'}</code> only if you want to show a spinner
					while data loads.
				</p>
			</div>
			<div class="info-item">
				<h3>Cross-Tab Sync</h3>
				<p>
					Changes sync across browser tabs using BroadcastChannel. Open this page in two tabs to
					test!
				</p>
			</div>
			<div class="info-item">
				<h3>Large Data Support</h3>
				<p>IndexedDB can store 50MB+ of data, unlike localStorage's ~5MB limit.</p>
			</div>
		</div>
	</div>
</main>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	h1 {
		text-align: center;
		color: #333;
		margin-bottom: 0.5rem;
		border-bottom: 3px solid;
		padding-bottom: 1rem;
	}

	.intro {
		text-align: center;
		color: #666;
		margin-bottom: 1rem;
	}

	.intro code {
		background: #f5f5f5;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 2rem;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.section {
		margin-bottom: 2rem;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.settings-section {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 2px solid #dee2e6;
	}

	.notes-section {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 2px solid #dee2e6;
	}

	.info-section {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		border: 2px solid #dee2e6;
	}

	.section h2 {
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 1.4rem;
		color: #333;
	}

	.section-description {
		margin-bottom: 1.5rem;
		opacity: 0.8;
		font-style: italic;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 8px;
		justify-content: center;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #ddd;
		border-top-color: #4caf50;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		padding: 1rem;
		background: rgba(244, 67, 54, 0.1);
		border: 1px solid #f44336;
		border-radius: 8px;
		color: #c62828;
	}

	.controls {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.checkbox-label,
	.select-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.6);
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
	}

	.checkbox-label input {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	select {
		padding: 0.3rem 0.5rem;
		border-radius: 4px;
		border: 1px solid #ccc;
		cursor: pointer;
	}

	button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-btn {
		background: #4caf50;
		color: white;
	}

	.add-btn:hover:not(:disabled) {
		background: #43a047;
		transform: translateY(-1px);
	}

	.clear-btn {
		background: #f44336;
		color: white;
	}

	.clear-btn:hover:not(:disabled) {
		background: #e53935;
	}

	.reset-btn {
		background: #9e9e9e;
		color: white;
		margin-left: auto;
	}

	.reset-btn:hover {
		background: #757575;
	}

	.add-note-form {
		background: rgba(255, 255, 255, 0.6);
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
	}

	.title-input,
	.content-input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		margin-bottom: 0.75rem;
		box-sizing: border-box;
	}

	.content-input {
		min-height: 80px;
		resize: vertical;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
	}

	.notes-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.empty {
		text-align: center;
		padding: 2rem;
		background: rgba(255, 255, 255, 0.6);
		border-radius: 8px;
		color: #666;
		font-style: italic;
	}

	.note-card {
		background: rgba(255, 255, 255, 0.8);
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.note-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.note-title {
		margin: 0;
		font-size: 1.1rem;
		color: #333;
	}

	.delete-btn {
		background: transparent;
		color: #999;
		font-size: 1.5rem;
		padding: 0;
		width: 28px;
		height: 28px;
		line-height: 1;
		border-radius: 50%;
	}

	.delete-btn:hover {
		background: #f44336;
		color: white;
	}

	.note-content {
		margin: 0.5rem 0;
		color: #555;
		white-space: pre-wrap;
	}

	.note-date {
		font-size: 0.8rem;
		color: #888;
	}

	.info-content {
		display: grid;
		gap: 1rem;
	}

	.info-item {
		background: rgba(255, 255, 255, 0.6);
		padding: 1rem;
		border-radius: 8px;
	}

	.info-item h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		color: #333;
	}

	.info-item p {
		margin: 0;
		font-size: 0.9rem;
		color: #555;
	}

	.info-item code {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.85rem;
	}

	@media (max-width: 600px) {
		.container {
			padding: 1rem;
		}

		.controls {
			flex-direction: column;
			align-items: stretch;
		}

		.reset-btn {
			margin-left: 0;
		}

		.form-actions {
			flex-direction: column;
		}
	}
</style>
