<script lang="ts">
	import { userSession, cart, preferences } from './states.svelte.js';
	const theme = $derived(preferences.current.theme);
	const fontSize = $derived(preferences.current.fontSize);

	const totalCartItems = $derived(
		Object.values(cart.current).reduce((sum, quantity) => sum + quantity, 0)
	);

	function login(username: string) {
		userSession.current = { isLoggedIn: true, username };
	}

	function logout() {
		userSession.current = { isLoggedIn: false, username: '' };
	}
	function addToCart(item: string) {
		cart.current = {
			...cart.current,
			[item]: (cart.current[item] || 0) + 1
		};
	}

	function clearCart() {
		cart.current = {};
	}
</script>

<main class="container">
	<h1>Svelte Persisted State Demo</h1>
	<div class="section localStorage-section">
		<h2>LocalStorage Demo</h2>
		<p class="section-description">
			These preferences are stored in localStorage and sync across tabs
		</p>
		<div class="controls">
			<button onclick={() => (preferences.current.theme = theme === 'light' ? 'dark' : 'light')}>
				🌓 Switch to {theme === 'light' ? 'dark' : 'light'} theme
			</button>
			<button onclick={() => (preferences.current.fontSize -= 1)}> 🔍 Decrease font size </button>
			<button onclick={() => (preferences.current.fontSize += 1)}> 🔎 Increase font size </button>
			<button onclick={preferences.reset} class="reset-btn"> 🔄 Reset to defaults </button>
		</div>
		<div class="status">
			<p style="font-size: {fontSize}px"><strong>Current theme:</strong> {theme}</p>
			<p style="font-size: {fontSize}px"><strong>Current font size:</strong> {fontSize}px</p>
		</div>
	</div>
	<div class="section cookie-section">
		<h2>Cookie Storage Demo</h2>
		<p class="section-description">
			These data are stored in cookies and persist across browser sessions
		</p>

		<div class="subsection">
			<h3>User Session (30 days)</h3>
			{#if userSession.current.isLoggedIn}
				<p class="welcome">Welcome back, <strong>{userSession.current.username}</strong>!</p>
				<button onclick={logout} class="logout-btn">🚪 Logout</button>
			{:else}
				<button onclick={() => login('demo-user')} class="login-btn">🔐 Login as Demo User</button>
			{/if}
		</div>
		<div class="subsection">
			<h3>Shopping Cart (7 days)</h3>
			<p class="cart-count">Cart items: <strong>{totalCartItems}</strong></p>
			<div class="cart-controls">
				<button onclick={() => addToCart('Apple')} class="add-btn">🍎 Add Apple</button>
				<button onclick={() => addToCart('Banana')} class="add-btn">🍌 Add Banana</button>
				<button onclick={() => addToCart('Orange')} class="add-btn">🍊 Add Orange</button>
				<button onclick={clearCart} class="clear-btn">🗑️ Clear Cart</button>
			</div>
			<div class="cart-display">
				{#if totalCartItems > 0}
					<ul class="cart-items">
						{#each Object.entries(cart.current) as [item, quantity]}
							<li class="cart-item">
								<span class="item-name">{item}</span>
								<span class="item-quantity">×{quantity}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-cart">Cart is empty</p>
				{/if}
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
		margin-bottom: 2rem;
		border-bottom: 3px solid #202020;
		padding-bottom: 1rem;
	}

	.section {
		margin-bottom: 3rem;
		padding: 2rem;
		border-radius: 12px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}
	.localStorage-section {
		background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
		color: #495057;
		border: 2px solid #dee2e6;
	}

	.cookie-section {
		background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%);
		color: #495057;
		border: 2px solid #dadce0;
	}

	.section h2 {
		margin-top: 0;
		margin-bottom: 0.5rem;
		font-size: 1.5rem;
	}

	.section-description {
		margin-bottom: 1.5rem;
		opacity: 0.9;
		font-style: italic;
	}
	.subsection {
		background: rgba(255, 255, 255, 0.6);
		padding: 1.5rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		border: 1px solid #e9ecef;
	}

	.subsection h3 {
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1.2rem;
	}

	.controls,
	.cart-controls {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}
	.localStorage-section button {
		background: rgba(33, 150, 243, 0.9);
		color: white;
		border: 2px solid #2196f3;
	}

	.localStorage-section button:hover {
		background: rgba(33, 150, 243, 1);
		transform: translateY(-2px);
	}

	.cookie-section button {
		background: rgba(156, 39, 176, 0.9);
		color: white;
		border: 2px solid #9c27b0;
	}

	.cookie-section button:hover {
		background: rgba(156, 39, 176, 1);
		transform: translateY(-2px);
	}
	.add-btn {
		background: rgba(76, 175, 80, 0.9) !important;
		color: white !important;
		border: 2px solid #4caf50 !important;
	}

	.clear-btn {
		background: rgba(244, 67, 54, 0.9) !important;
		color: white !important;
		border: 2px solid #f44336 !important;
	}

	.login-btn {
		background: rgba(33, 150, 243, 0.9) !important;
		color: white !important;
		border: 2px solid #2196f3 !important;
	}
	.logout-btn {
		background: rgba(255, 152, 0, 0.9) !important;
		color: white !important;
		border: 2px solid #ff9800 !important;
	}

	.reset-btn {
		background: rgba(158, 158, 158, 0.9) !important;
		color: white !important;
		border: 2px solid #9e9e9e !important;
	}
	.status {
		background: rgba(255, 255, 255, 0.6);
		padding: 1rem;
		border-radius: 6px;
		border: 1px solid #e9ecef;
	}

	.status p {
		margin: 0.5rem 0;
	}

	.welcome {
		background: rgba(76, 175, 80, 0.2);
		padding: 1rem;
		border-radius: 6px;
		margin-bottom: 1rem;
	}

	.cart-count {
		font-size: 1.1rem;
		margin-bottom: 1rem;
	}

	.cart-display {
		margin-top: 1rem;
	}
	.cart-items {
		background: rgba(255, 255, 255, 0.6);
		padding: 1rem;
		border-radius: 6px;
		margin: 0;
		list-style: none;
		border: 1px solid #e9ecef;
	}
	.cart-items li {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	.cart-items li:last-child {
		border-bottom: none;
	}

	.cart-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.item-name {
		font-weight: 500;
	}

	.item-quantity {
		background: rgba(0, 0, 0, 0.1);
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		font-size: 0.9rem;
		font-weight: 600;
		color: #666;
	}
	.empty-cart {
		background: rgba(255, 255, 255, 0.6);
		padding: 1rem;
		border-radius: 6px;
		text-align: center;
		font-style: italic;
		opacity: 0.8;
		border: 1px solid #e9ecef;
	}

	@media (max-width: 600px) {
		.container {
			padding: 1rem;
		}

		.controls,
		.cart-controls {
			flex-direction: column;
		}

		button {
			width: 100%;
		}
	}
</style>
