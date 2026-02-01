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
			await setItem('testKey2', 'storedValue');

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
			expect(storedValue).toBe('newValue');
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
			await setItem('testKey5', { count: 42 });

			const onHydrated = vi.fn();
			const state = persistedStateAsync<TestState>('testKey5', { count: 0 }, {
				onHydrated
			});

			await state.ready;

			expect(onHydrated).toHaveBeenCalledWith({ count: 42 });
		});

		it('should handle parse errors gracefully with custom serializer', async () => {
			await setItem('testKey6', 'invalid JSON{{{');

			const onParseError = vi.fn();
			const state = persistedStateAsync<string>('testKey6', 'initialValue', {
				serializer: JSON,
				onParseError
			});

			await state.ready;

			expect(onParseError).toHaveBeenCalled();
			expect(state.current).toBe('initialValue');
		});

		it('should apply beforeRead transformation', async () => {
			await setItem('testKey7', { count: 5 });

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

			const storedValue = await getItem<TestState>('testKey8');
			expect(storedValue).toEqual({ count: 10 });
		});

		it('should use custom serializer when provided', async () => {
			const customSerializer = {
				parse: vi.fn((v: string) => JSON.parse(v)),
				stringify: vi.fn((v: TestState) => JSON.stringify(v))
			};

			// When using a custom serializer, storage contains serialized strings
			await setItem('testKey9', JSON.stringify({ count: 5 }));

			const state = persistedStateAsync<TestState>('testKey9', { count: 0 }, {
				serializer: customSerializer
			});

			await state.ready;

			expect(customSerializer.parse).toHaveBeenCalled();
			expect(state.current).toEqual({ count: 5 });

			state.current = { count: 10 };
			await waitForNextTick();
			await waitForHydration();

			expect(customSerializer.stringify).toHaveBeenCalled();

			// Verify stored as string
			const storedValue = await getItem<string>('testKey9');
			expect(storedValue).toBe(JSON.stringify({ count: 10 }));
		});

		it('should use custom IndexedDB options', async () => {
			const options = { dbName: 'my-app', storeName: 'my-store', version: 1 };
			await setItem('testKey10', 'storedValue', options);

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
			await setItem('testKey12', { count: 42 });

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
			await setItem('awaitKey', { items: [1, 2, 3] });

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

		it('should handle parse errors in broadcast messages with custom serializer', async () => {
			const onParseError = vi.fn();

			const state = persistedStateAsync<TestState>('broadcastKey', { count: 0 }, {
				syncTabs: true,
				serializer: JSON,
				onParseError
			});

			await state.ready;

			// Manually send invalid message (only causes parse error when serializer is used)
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

	describe('structured clone support (native types)', () => {
		it('should store and retrieve Date objects natively', async () => {
			const testDate = new Date('2024-01-15T12:00:00.000Z');
			await setItem('dateKey', testDate);

			const state = persistedStateAsync<Date>('dateKey', new Date(0));

			await state.ready;

			expect(state.current).toBeInstanceOf(Date);
			expect(state.current.getTime()).toBe(testDate.getTime());
		});

		it('should persist Date objects without serializer', async () => {
			const testDate = new Date('2024-06-20T15:30:00.000Z');

			const state = persistedStateAsync<Date>('dateKey2', new Date(0));

			await state.ready;

			state.current = testDate;
			await waitForNextTick();
			await waitForHydration();

			const storedValue = await getItem<Date>('dateKey2');
			expect(storedValue).toBeInstanceOf(Date);
			expect(storedValue!.getTime()).toBe(testDate.getTime());
		});

		it('should store and retrieve Map objects natively', async () => {
			const testMap = new Map([
				['key1', 'value1'],
				['key2', 'value2']
			]);
			await setItem('mapKey', testMap);

			const state = persistedStateAsync<Map<string, string>>('mapKey', new Map());

			await state.ready;

			expect(state.current).toBeInstanceOf(Map);
			expect(state.current.get('key1')).toBe('value1');
			expect(state.current.get('key2')).toBe('value2');
			expect(state.current.size).toBe(2);
		});

		it('should persist Map objects without serializer', async () => {
			const state = persistedStateAsync<Map<string, number>>('mapKey2', new Map());

			await state.ready;

			state.current = new Map([
				['a', 1],
				['b', 2],
				['c', 3]
			]);
			await waitForNextTick();
			await waitForHydration();

			const storedValue = await getItem<Map<string, number>>('mapKey2');
			expect(storedValue).toBeInstanceOf(Map);
			expect(storedValue!.get('a')).toBe(1);
			expect(storedValue!.get('b')).toBe(2);
			expect(storedValue!.get('c')).toBe(3);
		});

		it('should store and retrieve Set objects natively', async () => {
			const testSet = new Set(['item1', 'item2', 'item3']);
			await setItem('setKey', testSet);

			const state = persistedStateAsync<Set<string>>('setKey', new Set());

			await state.ready;

			expect(state.current).toBeInstanceOf(Set);
			expect(state.current.has('item1')).toBe(true);
			expect(state.current.has('item2')).toBe(true);
			expect(state.current.has('item3')).toBe(true);
			expect(state.current.size).toBe(3);
		});

		it('should persist Set objects without serializer', async () => {
			const state = persistedStateAsync<Set<number>>('setKey2', new Set());

			await state.ready;

			state.current = new Set([1, 2, 3, 4, 5]);
			await waitForNextTick();
			await waitForHydration();

			const storedValue = await getItem<Set<number>>('setKey2');
			expect(storedValue).toBeInstanceOf(Set);
			expect(storedValue!.has(1)).toBe(true);
			expect(storedValue!.has(5)).toBe(true);
			expect(storedValue!.size).toBe(5);
		});

		it('should store and retrieve RegExp objects natively', async () => {
			const testRegex = /hello\s+world/gi;
			await setItem('regexKey', testRegex);

			const state = persistedStateAsync<RegExp>('regexKey', /default/);

			await state.ready;

			expect(state.current).toBeInstanceOf(RegExp);
			expect(state.current.source).toBe(testRegex.source);
			expect(state.current.flags).toBe(testRegex.flags);
		});

		it('should store and retrieve Uint8Array natively', async () => {
			// Note: Using Uint8Array instead of ArrayBuffer for better cross-environment compatibility
			const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

			await setItem('bufferKey', data);

			const state = persistedStateAsync<Uint8Array>('bufferKey', new Uint8Array(0));

			await state.ready;

			// Use constructor name check for cross-realm compatibility in test environment
			expect(state.current.constructor.name).toBe('Uint8Array');
			expect(state.current.length).toBe(8);
			expect(Array.from(state.current)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		});

		it('should store complex nested objects with native types', async () => {
			interface ComplexState {
				name: string;
				createdAt: Date;
				tags: Set<string>;
				metadata: Map<string, number | boolean>;
			}

			const testState: ComplexState = {
				name: 'Test',
				createdAt: new Date('2024-03-15'),
				tags: new Set(['svelte', 'typescript']),
				metadata: new Map<string, number | boolean>([
					['version', 1],
					['active', true]
				])
			};

			await setItem('complexKey', testState);

			const state = persistedStateAsync<ComplexState>('complexKey', {
				name: '',
				createdAt: new Date(0),
				tags: new Set(),
				metadata: new Map()
			});

			await state.ready;

			expect(state.current.name).toBe('Test');
			expect(state.current.createdAt).toBeInstanceOf(Date);
			expect(state.current.createdAt.getTime()).toBe(new Date('2024-03-15').getTime());
			expect(state.current.tags).toBeInstanceOf(Set);
			expect(state.current.tags.has('svelte')).toBe(true);
			expect(state.current.metadata).toBeInstanceOf(Map);
			expect(state.current.metadata.get('version')).toBe(1);
		});

		it('should sync native types across tabs via BroadcastChannel', async () => {
			const state1 = persistedStateAsync<Date>('syncDateKey', new Date(0), {
				syncTabs: true
			});

			const state2 = persistedStateAsync<Date>('syncDateKey', new Date(0), {
				syncTabs: true
			});

			await state1.ready;
			await state2.ready;

			const newDate = new Date('2024-12-25T00:00:00.000Z');
			state1.current = newDate;
			await waitForNextTick();
			await waitForHydration();

			expect(state2.current).toBeInstanceOf(Date);
			expect(state2.current.getTime()).toBe(newDate.getTime());
		});
	});
});
