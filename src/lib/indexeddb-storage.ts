const DEFAULT_DB_NAME = 'svelte-persisted-state';
const DEFAULT_STORE_NAME = 'state';
const DEFAULT_VERSION = 1;

export interface IndexedDBOptions {
	dbName?: string;
	storeName?: string;
	version?: number;
}

interface DBConnection {
	db: IDBDatabase;
	storeName: string;
}

let connectionCache: Map<string, DBConnection> = new Map();

function getCacheKey(options: Required<IndexedDBOptions>): string {
	return `${options.dbName}:${options.storeName}:${options.version}`;
}

export function openDB(options: IndexedDBOptions = {}): Promise<DBConnection> {
	const dbName = options.dbName ?? DEFAULT_DB_NAME;
	const storeName = options.storeName ?? DEFAULT_STORE_NAME;
	const version = options.version ?? DEFAULT_VERSION;

	const cacheKey = getCacheKey({ dbName, storeName, version });
	const cached = connectionCache.get(cacheKey);
	if (cached) {
		return Promise.resolve(cached);
	}

	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName, version);

		request.onerror = () => {
			reject(request.error);
		};

		request.onsuccess = () => {
			const connection: DBConnection = { db: request.result, storeName };
			connectionCache.set(cacheKey, connection);
			resolve(connection);
		};

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName);
			}
		};
	});
}

export async function getItem<T>(key: string, options: IndexedDBOptions = {}): Promise<T | null> {
	const { db, storeName } = await openDB(options);

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readonly');
		const store = transaction.objectStore(storeName);
		const request = store.get(key);

		request.onerror = () => {
			reject(request.error);
		};

		request.onsuccess = () => {
			resolve(request.result ?? null);
		};
	});
}

export async function setItem<T>(
	key: string,
	value: T,
	options: IndexedDBOptions = {}
): Promise<void> {
	const { db, storeName } = await openDB(options);

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.put(value, key);

		request.onerror = () => {
			reject(request.error);
		};

		request.onsuccess = () => {
			resolve();
		};
	});
}

export async function removeItem(key: string, options: IndexedDBOptions = {}): Promise<void> {
	const { db, storeName } = await openDB(options);

	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, 'readwrite');
		const store = transaction.objectStore(storeName);
		const request = store.delete(key);

		request.onerror = () => {
			reject(request.error);
		};

		request.onsuccess = () => {
			resolve();
		};
	});
}

export function closeDB(options: IndexedDBOptions = {}): void {
	const dbName = options.dbName ?? DEFAULT_DB_NAME;
	const storeName = options.storeName ?? DEFAULT_STORE_NAME;
	const version = options.version ?? DEFAULT_VERSION;

	const cacheKey = getCacheKey({ dbName, storeName, version });
	const cached = connectionCache.get(cacheKey);
	if (cached) {
		cached.db.close();
		connectionCache.delete(cacheKey);
	}
}

export function closeAllDBs(): void {
	for (const connection of connectionCache.values()) {
		connection.db.close();
	}
	connectionCache.clear();
}

export function clearConnectionCache(): void {
	connectionCache = new Map();
}
