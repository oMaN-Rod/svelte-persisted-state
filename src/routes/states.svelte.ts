import { persistedState } from '$lib/index.svelte.js';

export const userSession = persistedState(
	'user-session',
	{
		isLoggedIn: false,
		username: ''
	},
	{
		storage: 'cookie',
		cookieOptions: {
			maxAge: 2592000 / 2,
			secure: false,
			sameSite: 'Lax',
			path: '/'
		}
	}
);

export const cart = persistedState<Record<string, number>>(
	'shopping-cart',
	{},
	{
		storage: 'cookie',
		cookieExpireDays: 7
	}
);

interface UserPreferences {
	theme: 'light' | 'dark';
	fontSize: number;
}

export const preferences = persistedState<UserPreferences>('preferences', {
	theme: 'light',
	fontSize: 16
});
