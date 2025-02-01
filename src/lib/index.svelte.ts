type Serializer<T> = {
	parse: (text: string) => T;
	stringify: (object: T) => string;
};

type StorageType = 'local' | 'session';

interface Options<T> {
	storage?: StorageType;
	serializer?: Serializer<T>;
	syncTabs?: boolean;
	onWriteError?: (error: unknown) => void;
	onParseError?: (error: unknown) => void;
	beforeRead?: (value: T) => T;
	beforeWrite?: (value: T) => T;
}

function getStorage(type: StorageType) {
	return type === 'local' ? localStorage : sessionStorage;
}

export function persistedState<T>(key: string, initialValue: T, options: Options<T> = {}) {
	const {
		storage = 'local',
		serializer = JSON,
		syncTabs = true,
		onWriteError = console.error,
		onParseError = console.error,
		beforeRead = (v: T) => v,
		beforeWrite = (v: T) => v
	} = options;

	const browser = typeof window !== 'undefined' && typeof document !== 'undefined';
	const storageArea = browser ? getStorage(storage) : null;

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

		return () => {};
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
