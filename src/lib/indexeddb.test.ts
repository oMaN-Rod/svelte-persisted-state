import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistedStateAsync } from './index.svelte';
import {
	getItem,
	setItem,
	closeAllDBs,
	clearConnectionCache
} from './indexeddb-storage.js';

interface TestState {
	count: number;
}

async function waitForNextTick() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForHydration() {
	await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('IndexedDB Storage', () => {
	beforeEach(() => {
		closeAllDBs();
		clearConnectionCache();
	});

	afterEach(() => {
		closeAllDBs();
		clearConnectionCache();
	});

	describe('low-level storage functions', () => {
		it('should store and retrieve a value', async () => {
			await setItem('testKey', 'testValue');
			const result = await getItem<string>('testKey');
			expect(result).toBe('testValue');
		});

		it('should return null for non-existent key', async () => {
			const result = await getItem<string>('nonExistent');
			expect(result).toBeNull();
		});

		it('should store complex objects', async () => {
			const obj = { name: 'test', count: 42, nested: { value: true, list: ['item1', 'item2'] } };
			await setItem('objectKey', obj);
			const result = await getItem<typeof obj>('objectKey');
			expect(result).toEqual(obj);
		});

		it('should overwrite existing values', async () => {
			await setItem('key', 'first');
			await setItem('key', 'second');
			const result = await getItem<string>('key');
			expect(result).toBe('second');
		});

		it('should use custom database options', async () => {
			const options = { dbName: 'custom-db', storeName: 'custom-store', version: 1 };
			await setItem('key', 'value', options);
			const result = await getItem<string>('key', options);
			expect(result).toBe('value');
		});
	});

	describe('persistedStateAsync', () => {
		it('should initialize with the initial value', async () => {
			const state = persistedStateAsync<string>('testKey1', 'initialValue');

			expect(state.current).toBe('initialValue');
			expect(state.isLoading).toBe(true);

			await state.ready;

			expect(state.isLoading).toBe(false);
		});

		it('should hydrate from stored value', async () => {
			// Pre-populate storage
			await setItem('testKey2', JSON.stringify('storedValue'));

			const state = persistedStateAsync<string>('testKey2', 'initialValue');

			expect(state.current).toBe('initialValue');

			await state.ready;

			expect(state.current).toBe('storedValue');
			expect(state.isLoading).toBe(false);
		});

		it('should persist value changes to IndexedDB', async () => {
			const state = persistedStateAsync<string>('testKey3', 'initialValue');

			await state.ready;

			state.current = 'newValue';
			await waitForNextTick();
			await waitForHydration();

			const storedValue = await getItem<string>('testKey3');
			expect(storedValue).toBe(JSON.stringify('newValue'));
		});

		it('should reset to initial value', async () => {
			const state = persistedStateAsync<string>('testKey4', 'initialValue');

			await state.ready;

			state.current = 'newValue';
			await waitForNextTick();

			state.reset();
			await waitForNextTick();

			expect(state.current).toBe('initialValue');
		});

		it('should call onHydrated callback', async () => {
			await setItem('testKey5', JSON.stringify({ count: 42 }));

			const onHydrated = vi.fn();
			const state = persistedStateAsync<TestState>('testKey5', { count: 0 }, {
				onHydrated
			});

			await state.ready;

			expect(onHydrated).toHaveBeenCalledWith({ count: 42 });
		});

		it('should handle parse errors gracefully', async () => {
			await setItem('testKey6', 'invalid JSON{{{');

			const onParseError = vi.fn();
			const state = persistedStateAsync<string>('testKey6', 'initialValue', {
				onParseError
			});

			await state.ready;

			expect(onParseError).toHaveBeenCalled();
			expect(state.current).toBe('initialValue');
		});

		it('should apply beforeRead transformation', async () => {
			await setItem('testKey7', JSON.stringify({ count: 5 }));

			const state = persistedStateAsync<TestState>('testKey7', { count: 0 }, {
				beforeRead: (v) => ({ count: v.count * 2 })
			});

			await state.ready;

			expect(state.current).toEqual({ count: 10 });
		});

		it('should apply beforeWrite transformation', async () => {
			const state = persistedStateAsync<TestState>('testKey8', { count: 0 }, {
				beforeWrite: (v) => ({ count: v.count * 2 })
			});

			await state.ready;

			state.current = { count: 5 };
			await waitForNextTick();
			await waitForHydration();

			const storedValue = await getItem<string>('testKey8');
			expect(JSON.parse(storedValue!)).toEqual({ count: 10 });
		});

		it('should use custom serializer', async () => {
			const customSerializer = {
				parse: vi.fn((v: string) => JSON.parse(v)),
				stringify: vi.fn((v: TestState) => JSON.stringify(v))
			};

			await setItem('testKey9', JSON.stringify({ count: 5 }));

			const state = persistedStateAsync<TestState>('testKey9', { count: 0 }, {
				serializer: customSerializer
			});

			await state.ready;

			expect(customSerializer.parse).toHaveBeenCalled();

			state.current = { count: 10 };
			await waitForNextTick();
			await waitForHydration();

			expect(customSerializer.stringify).toHaveBeenCalled();
		});

		it('should use custom IndexedDB options', async () => {
			const options = { dbName: 'my-app', storeName: 'my-store', version: 1 };
			await setItem('testKey10', JSON.stringify('storedValue'), options);

			const state = persistedStateAsync<string>('testKey10', 'initialValue', {
				indexedDB: options
			});

			await state.ready;

			expect(state.current).toBe('storedValue');
		});

		it('should handle write errors', async () => {
			const onWriteError = vi.fn();
			const state = persistedStateAsync<TestState>('testKey11', { count: 0 }, {
				onWriteError,
				serializer: {
					parse: JSON.parse,
					stringify: () => {
						throw new Error('Serialization error');
					}
				}
			});

			await state.ready;

			state.current = { count: 5 };
			await waitForNextTick();
			await waitForHydration();

			expect(onWriteError).toHaveBeenCalled();
		});

		it('should resolve ready promise with hydrated value', async () => {
			await setItem('testKey12', JSON.stringify({ count: 42 }));

			const state = persistedStateAsync<TestState>('testKey12', { count: 0 });

			const result = await state.ready;

			expect(result).toEqual({ count: 42 });
		});

		it('should resolve ready with initial value when no stored value', async () => {
			const state = persistedStateAsync<string>('nonExistent', 'initial');

			const result = await state.ready;

			expect(result).toBe('initial');
		});

		it('should work with await pattern for success case', async () => {
			await setItem('awaitKey', JSON.stringify({ items: [1, 2, 3] }));

			const state = persistedStateAsync<{ items: number[] }>('awaitKey', { items: [] });

			// Simulate {#await state.ready} {:then value} pattern
			const value = await state.ready;
			expect(value).toEqual({ items: [1, 2, 3] });
			expect(state.current).toEqual({ items: [1, 2, 3] });
		});
	});

	describe('cross-tab sync via BroadcastChannel', () => {
		it('should sync state changes across channels', async () => {
			const state1 = persistedStateAsync<string>('syncKey1', 'initial', {
				syncTabs: true
			});

			const state2 = persistedStateAsync<string>('syncKey1', 'initial', {
				syncTabs: true
			});

			await state1.ready;
			await state2.ready;

			// Update state1
			state1.current = 'updated';
			await waitForNextTick();
			await waitForHydration();

			// state2 should receive the update via BroadcastChannel
			expect(state2.current).toBe('updated');
		});

		it('should not sync when syncTabs is false', async () => {
			const state1 = persistedStateAsync<string>('noSyncKey', 'initial', {
				syncTabs: false
			});

			const state2 = persistedStateAsync<string>('noSyncKey', 'initial', {
				syncTabs: false
			});

			await state1.ready;
			await state2.ready;

			state1.current = 'updated';
			await waitForNextTick();
			await waitForHydration();

			// state2 should not receive the update
			expect(state2.current).toBe('initial');
		});

		it('should handle parse errors in broadcast messages', async () => {
			const onParseError = vi.fn();

			const state = persistedStateAsync<TestState>('broadcastKey', { count: 0 }, {
				syncTabs: true,
				onParseError
			});

			await state.ready;

			// Manually send invalid message
			const channel = new BroadcastChannel('svelte-persisted-state:svelte-persisted-state');
			channel.postMessage({ key: 'broadcastKey', value: 'invalid JSON{{{' });

			await waitForNextTick();
			await waitForHydration();

			expect(onParseError).toHaveBeenCalled();
			expect(state.current).toEqual({ count: 0 });

			channel.close();
		});

		it('should only sync matching keys', async () => {
			const state1 = persistedStateAsync<string>('key1', 'initial1', {
				syncTabs: true
			});

			const state2 = persistedStateAsync<string>('key2', 'initial2', {
				syncTabs: true
			});

			await state1.ready;
			await state2.ready;

			state1.current = 'updated';
			await waitForNextTick();
			await waitForHydration();

			// state2 should not be affected
			expect(state2.current).toBe('initial2');
		});

		it('should apply beforeRead transformation on broadcast messages', async () => {
			const state1 = persistedStateAsync<TestState>('transformBroadcastKey', { count: 0 }, {
				syncTabs: true
			});

			const state2 = persistedStateAsync<TestState>('transformBroadcastKey', { count: 0 }, {
				syncTabs: true,
				beforeRead: (v) => ({ count: v.count * 2 })
			});

			await state1.ready;
			await state2.ready;

			state1.current = { count: 5 };
			await waitForNextTick();
			await waitForHydration();

			expect(state2.current).toEqual({ count: 10 });
		});
	});
});
