import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { persistedState } from './lib/index.svelte';

interface TestState {
	count: number;
}

async function waitForNextTick() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function clearAllCookies() {
	// Clear all cookies by setting their expiration date in the past
	document.cookie.split(';').forEach((cookie) => {
		const [name] = cookie.split('=');
		document.cookie = `${name.trim()}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
	});
}

function getCookieValue(name: string): string | null {
	const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? decodeURIComponent(match[2]) : null;
}

describe('persistedState', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		clearAllCookies();
	});

	afterEach(() => {
		localStorage.clear();
		sessionStorage.clear();
		clearAllCookies();
	});

	it('should initialize with the initial value when no stored value exists', () => {
		const state = persistedState<string>('testKey', 'initialValue');

		expect(state.current).toBe('initialValue');
	});

	it('should use the stored value when it exists', () => {
		localStorage.setItem('testKey', JSON.stringify('storedValue'));
		const state = persistedState<string>('testKey', 'initialValue');

		expect(state.current).toBe('storedValue');
	});

	it('should update the storage when the value changes', async () => {
		const state = persistedState<string>('testKey', 'initialValue');

		state.current = 'newValue';
		await waitForNextTick();

		expect(localStorage.getItem('testKey')).toBe('"newValue"');
	});

	it('should reset to the initial value', async () => {
		const state = persistedState<string>('testKey', 'initialValue');

		state.current = 'newValue';
		state.reset();
		await waitForNextTick();

		expect(state.current).toBe('initialValue');
		expect(JSON.parse(localStorage.getItem('testKey') || '')).toBe('initialValue');
	});

	it('should use session storage when specified', async () => {
		const setItemSpy = vi.spyOn(Object.getPrototypeOf(window.sessionStorage), 'setItem');
		const state = persistedState<string>('testKey', 'initialValue', { storage: 'session' });

		state.current = 'newValue';
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

		state.current = { count: 10 };
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
		expect(state.current).toBe('initialValue');
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
		state.current = 'newValue';
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

		expect(state.current).toEqual({ count: 10 });
	});

	it('should apply beforeWrite transformation', async () => {
		const state = persistedState<TestState>(
			'testKey',
			{ count: 0 },
			{
				beforeWrite: (v: TestState): TestState => ({ count: v.count * 2 })
			}
		);

		state.current = { count: 5 };
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

		expect(state.current).toBe('updatedValue');
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

		expect(state.current).toBe('initialValue');
	});

	// ---- Cookie-specific tests ----

	it('should initialize with the initial value when no cookie exists', () => {
		const state = persistedState<string>('cookieKey', 'cookieInitial', { storage: 'cookie' });

		expect(state.current).toBe('cookieInitial');
	});

	it('should use the stored cookie value when it exists', () => {
		// Simulate a cookie storing a JSON string: '"cookieStored"'
		document.cookie = `cookieKey=${encodeURIComponent('"cookieStored"')};path=/`;
		const state = persistedState<string>('cookieKey', 'cookieInitial', { storage: 'cookie' });

		expect(state.current).toBe('cookieStored');
	});

	it('should update the cookie when the value changes', async () => {
		const state = persistedState<string>('cookieKey', 'cookieInitial', { storage: 'cookie' });

		state.current = 'cookieNew';
		await waitForNextTick();

		const raw = getCookieValue('cookieKey');
		expect(raw).not.toBeNull();
		// raw is the JSON string '"cookieNew"'
		expect(JSON.parse(raw!)).toBe('cookieNew');
	});

	it('should reset cookie to the initial value', async () => {
		const state = persistedState<string>('cookieKey', 'cookieInitial', { storage: 'cookie' });

		state.current = 'cookieNew';
		state.reset();
		await waitForNextTick();

		expect(state.current).toBe('cookieInitial');
		const raw = getCookieValue('cookieKey');
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!)).toBe('cookieInitial');
	});

	it('should not sync across tabs for cookies even if syncTabs is true', async () => {
		const state = persistedState<string>('cookieKey', 'cookieInitial', {
			storage: 'cookie',
			syncTabs: true
		});
		await waitForNextTick();

		// Simulate storage event (which cookies do not trigger)
		const storageEvent = new StorageEvent('storage', {
			key: 'cookieKey',
			newValue: JSON.stringify('cookieUpdated'),
			storageArea: localStorage
		});
		window.dispatchEvent(storageEvent);

		await waitForNextTick();

		// Value should remain unchanged because cookies don't use storage events
		expect(state.current).toBe('cookieInitial');
	});
});
