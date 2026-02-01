import {
	getItem as idbGetItem,
	setItem as idbSetItem,
	closeDB,
	type IndexedDBOptions
} from './indexeddb-storage.js';

type Serializer<T> = {
	parse: (text: string) => T;
	stringify: (object: T) => string;
};

type StorageType = 'local' | 'session' | 'cookie';

export type { IndexedDBOptions };

interface CookieOptions {
	expireDays?: number;
	maxAge?: number;
	path?: string;
	domain?: string;
	secure?: boolean;
	sameSite?: 'Strict' | 'Lax' | 'None';
	httpOnly?: boolean;
}

interface Options<T> {
	storage?: StorageType;
	serializer?: Serializer<T>;
	syncTabs?: boolean;
	/** @deprecated Use cookieOptions.expireDays instead */
	cookieExpireDays?: number;
	cookieOptions?: CookieOptions;
	onWriteError?: (error: unknown) => void;
	onParseError?: (error: unknown) => void;
	beforeRead?: (value: T) => T;
	beforeWrite?: (value: T) => T;
}

function getCookie(name: string): string | null {
	const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
	return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, options: CookieOptions = {}) {
	const {
		expireDays = 365,
		maxAge,
		path = '/',
		domain,
		secure = false,
		sameSite = 'Lax',
		httpOnly = false
	} = options;

	let cookieString = `${name}=${encodeURIComponent(value)}`;
	cookieString += `; path=${path}`;

	// Use max-age if specified, otherwise use expires
	if (maxAge !== undefined) {
		cookieString += `; max-age=${maxAge}`;
	} else {
		const expires = new Date(Date.now() + expireDays * 864e5).toUTCString();
		cookieString += `; expires=${expires}`;
	}

	if (domain) {
		cookieString += `; domain=${domain}`;
	}

	if (secure) {
		cookieString += `; secure`;
	}

	cookieString += `; samesite=${sameSite}`;

	if (httpOnly) {
		cookieString += `; httponly`;
	}

	document.cookie = cookieString;
}

function getStorage(type: StorageType, cookieOptions: CookieOptions = {}) {
	if (type === 'local')
		return {
			getItem: (k: string) => localStorage.getItem(k),
			setItem: (k: string, v: string) => localStorage.setItem(k, v)
		};
	if (type === 'session')
		return {
			getItem: (k: string) => sessionStorage.getItem(k),
			setItem: (k: string, v: string) => sessionStorage.setItem(k, v)
		};
	// cookie
	return {
		getItem: getCookie,
		setItem: (k: string, v: string) => setCookie(k, v, cookieOptions)
	};
}

export interface AsyncOptions<T> {
	indexedDB?: IndexedDBOptions;
	serializer?: Serializer<T>;
	syncTabs?: boolean;
	onWriteError?: (error: unknown) => void;
	onParseError?: (error: unknown) => void;
	onHydrated?: (value: T) => void;
	onHydrationError?: (error: unknown) => void;
	beforeRead?: (value: T) => T;
	beforeWrite?: (value: T) => T;
}

export interface AsyncPersistedState<T> {
	get current(): T;
	set current(newValue: T);
	readonly isLoading: boolean;
	readonly ready: Promise<T>;
	reset(): void;
}

export function persistedState<T>(key: string, initialValue: T, options: Options<T> = {}) {
	const {
		storage = 'local',
		serializer = JSON,
		syncTabs = true,
		cookieExpireDays,
		cookieOptions = {},
		onWriteError = console.error,
		onParseError = console.error,
		beforeRead = (v: T) => v,
		beforeWrite = (v: T) => v
	} = options;

	// Handle backward compatibility with cookieExpireDays
	const finalCookieOptions: CookieOptions = {
		...cookieOptions,
		...(cookieExpireDays !== undefined && { expireDays: cookieExpireDays })
	};

	const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
	const storageArea = browser ? getStorage(storage, finalCookieOptions) : null;

	let storedValue: T;

	try {
		const item = storageArea?.getItem(key);
		storedValue = item ? beforeRead(serializer.parse(item)) : initialValue;
	} catch (error) {
		onParseError(error);
		storedValue = initialValue;
	}

	let state = $state(storedValue);

	function updateStorage(value: T) {
		try {
			const valueToStore = beforeWrite(value);
			storageArea?.setItem(key, serializer.stringify(valueToStore));
		} catch (error) {
			onWriteError(error);
		}
	}

	if (syncTabs && typeof window !== 'undefined' && storage === 'local') {
		window.addEventListener('storage', (event) => {
			if (event.key === key && event.storageArea === localStorage) {
				try {
					const newValue = event.newValue ? serializer.parse(event.newValue) : initialValue;
					state = beforeRead(newValue);
				} catch (error) {
					onParseError(error);
				}
			}
		});
	}

	$effect.root(() => {
		$effect(() => {
			updateStorage(state);
		});

		return () => { };
	});

	return {
		/**
		 * @deprecated Use current to align with Svelte conventions
		 */
		get value() {
			return state;
		},
		/**
		 * @deprecated Use current to align with Svelte conventions
		 */
		set value(newValue: T) {
			state = newValue;
		},
		get current() {
			return state;
		},
		set current(newValue: T) {
			state = newValue;
		},
		reset() {
			state = initialValue;
		}
	};
}

export function persistedStateAsync<T>(
	key: string,
	initialValue: T,
	options: AsyncOptions<T> = {}
): AsyncPersistedState<T> {
	const {
		indexedDB: indexedDBOptions = {},
		serializer,
		syncTabs = true,
		onWriteError = console.error,
		onParseError = console.error,
		onHydrated,
		onHydrationError = console.error,
		beforeRead = (v: T) => v,
		beforeWrite = (v: T) => v
	} = options;

	const browser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

	let state = $state<T>(initialValue);
	let isLoading = $state(browser);
	let resolveReady: (value: T) => void;
	let rejectReady: (error: unknown) => void;

	const ready = new Promise<T>((resolve, reject) => {
		resolveReady = resolve;
		rejectReady = reject;
	});

	let broadcastChannel: BroadcastChannel | null = null;
	let skipNextWrite = false;

	async function hydrate() {
		if (!browser) {
			isLoading = false;
			resolveReady(initialValue);
			return;
		}

		try {
			const storedValue = await idbGetItem<T>(key, indexedDBOptions);
			if (storedValue !== null) {
				try {
					const value = serializer ? serializer.parse(storedValue as string) : storedValue;
					state = beforeRead(value);
				} catch (error) {
					onParseError(error);
					state = initialValue;
				}
			}
			isLoading = false;
			onHydrated?.(state);
			resolveReady(state);
		} catch (error) {
			onHydrationError(error);
			isLoading = false;
			rejectReady(error);
		}
	}

	if (browser && syncTabs) {
		const channelName = `svelte-persisted-state:${indexedDBOptions.dbName ?? 'svelte-persisted-state'}`;
		broadcastChannel = new BroadcastChannel(channelName);

		broadcastChannel.onmessage = (event) => {
			if (event.data.key === key) {
				try {
					skipNextWrite = true;
					const value = serializer ? serializer.parse(event.data.value) : event.data.value;
					state = beforeRead(value);
				} catch (error) {
					skipNextWrite = false;
					onParseError(error);
				}
			}
		};
	}

	hydrate();

	$effect.root(() => {
		let isFirstRun = true;

		$effect(() => {
			const snapshot = $state.snapshot(state) as T;
			let valueToStore: T | string;
			try {
				const transformed = beforeWrite(snapshot);
				valueToStore = serializer ? serializer.stringify(transformed) : transformed;
			} catch (error) {
				onWriteError(error);
				return;
			}

			if (isFirstRun) {
				isFirstRun = false;
				return;
			}
			if (!isLoading && !skipNextWrite) {
				idbSetItem(key, valueToStore, indexedDBOptions)
					.then(() => {
						if (syncTabs && broadcastChannel) {
							broadcastChannel.postMessage({ key, value: valueToStore });
						}
					})
					.catch(onWriteError);
			}
			if (skipNextWrite) {
				skipNextWrite = false;
			}
		});

		return () => {
			broadcastChannel?.close();
			if (browser) {
				closeDB(indexedDBOptions);
			}
		};
	});

	return {
		get current() {
			return state;
		},
		set current(newValue: T) {
			state = newValue;
		},
		get isLoading() {
			return isLoading;
		},
		get ready() {
			return ready;
		},
		reset() {
			state = initialValue;
		}
	};
}
