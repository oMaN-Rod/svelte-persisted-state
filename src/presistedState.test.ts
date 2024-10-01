import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistedState } from './lib/index.svelte';

interface TestState {
	count: number;
}

async function waitForNextTick() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('persistedState', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('should initialize with the initial value when no stored value exists', () => {
		const state = persistedState<string>('testKey', 'initialValue');

		expect(state.value).toBe('initialValue');
	});

	it('should use the stored value when it exists', () => {
		localStorage.setItem('testKey', JSON.stringify('storedValue'));
		const state = persistedState<string>('testKey', 'initialValue');

		expect(state.value).toBe('storedValue');
	});

	it('should update the storage when the value changes', async () => {
		const state = persistedState<string>('testKey', 'initialValue');

		state.value = 'newValue';
		await waitForNextTick();

		expect(localStorage.getItem("testKey")).toBe('"newValue"');
	});

	it('should reset to the initial value', async () => {
		const state = persistedState<string>('testKey', 'initialValue');

		state.value = 'newValue';
		state.reset();
		await waitForNextTick();

		expect(state.value).toBe('initialValue');
		expect(JSON.parse(localStorage.getItem('testKey') || '')).toBe('initialValue');
	});

	it('should use session storage when specified', async () => {
		const setItemSpy = vi.spyOn(Object.getPrototypeOf(window.sessionStorage), 'setItem');
		const state = persistedState<string>('testKey', 'initialValue', { storage: 'session' });

		state.value = 'newValue';
		await waitForNextTick();

		expect(setItemSpy).toHaveBeenCalled();
		expect(sessionStorage.getItem('testKey')).toBe('"newValue"');
		expect(localStorage.getItem('testKey')).toBeNull();

		setItemSpy.mockRestore();
	});

	it('should use custom serializer', async () => {
		const customSerializer = {
			parse: vi.fn((v: string): TestState => JSON.parse(v)),
			stringify: vi.fn((v: TestState): string => JSON.stringify(v))
		};
		localStorage.setItem('testKey', '{"count":5}');

		const state = persistedState<TestState>(
			'testKey',
			{ count: 0 },
			{ serializer: customSerializer }
		);

		expect(customSerializer.parse).toHaveBeenCalled();

		state.value = { count: 10 };
		await waitForNextTick();

		expect(customSerializer.stringify).toHaveBeenCalled();
		expect(localStorage.getItem('testKey')).toBe('{"count":10}');
	});

	it('should handle parse errors', async () => {
		const onParseError = vi.fn();
		localStorage.setItem('testKey', 'invalid JSON');

		const state = persistedState<string>('testKey', 'initialValue', { onParseError });
		await waitForNextTick();

		expect(onParseError).toHaveBeenCalled();
		expect(state.value).toBe('initialValue');
	});

	it('should handle write errors', async () => {
		const onWriteError = vi.fn();
		const mockStorageArea = {
			setItem: vi.fn(() => {
				throw new Error('Write error');
			}),
			getItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		};

		vi.spyOn(window, 'localStorage', 'get').mockReturnValue(mockStorageArea as any);

		const state = persistedState<string>('testKey', 'initialValue', { onWriteError });
		state.value = 'newValue';
		await waitForNextTick();

		expect(onWriteError).toHaveBeenCalled();
		expect(mockStorageArea.setItem).toHaveBeenCalledWith('testKey', '"newValue"');

		vi.restoreAllMocks();
	});

	it('should apply beforeRead transformation', async () => {
		localStorage.setItem('testKey', JSON.stringify({ count: 5 }));

		const state = persistedState<TestState>(
			'testKey',
			{ count: 0 },
			{
				beforeRead: (v: TestState): TestState => ({ count: v.count * 2 })
			}
		);
		await waitForNextTick();

		expect(state.value).toEqual({ count: 10 });
	});

	it('should apply beforeWrite transformation', async () => {
		const state = persistedState<TestState>(
			'testKey',
			{ count: 0 },
			{
				beforeWrite: (v: TestState): TestState => ({ count: v.count * 2 })
			}
		);

		state.value = { count: 5 };
		await waitForNextTick();

		expect(JSON.parse(localStorage.getItem('testKey') || '')).toEqual({ count: 10 });
	});

	it('should sync across tabs when syncTabs is true', async () => {
		const state = persistedState<string>('testKey', 'initialValue', { syncTabs: true });
		await waitForNextTick();

		const storageEvent = new StorageEvent('storage', {
			key: 'testKey',
			newValue: JSON.stringify('updatedValue'),
			storageArea: localStorage
		});
		window.dispatchEvent(storageEvent);

		await waitForNextTick();

		expect(state.value).toBe('updatedValue');
	});

	it('should not sync across tabs when syncTabs is false', async () => {
		const state = persistedState<string>('testKey', 'initialValue', { syncTabs: false });
		await waitForNextTick();

		const storageEvent = new StorageEvent('storage', {
			key: 'testKey',
			newValue: JSON.stringify('updatedValue'),
			storageArea: localStorage
		});
		window.dispatchEvent(storageEvent);

		await waitForNextTick();

		expect(state.value).toBe('initialValue');
	});
});
