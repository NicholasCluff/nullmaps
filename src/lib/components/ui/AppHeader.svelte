<script lang="ts">
	export let onMenuToggle = () => {};

	let isSearchExpanded = false;
	let searchQuery = '';

	function toggleSearch() {
		isSearchExpanded = !isSearchExpanded;
		if (!isSearchExpanded) {
			searchQuery = '';
		}
	}

	function handleSearch() {
		if (searchQuery.trim()) {
			// TODO: Implement search functionality
			console.log('Searching for:', searchQuery);
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		} else if (event.key === 'Escape') {
			toggleSearch();
		}
	}
</script>

<header class="app-header">
	<div class="header-content">
		<!-- Menu button -->
		<button class="menu-button" onclick={onMenuToggle} aria-label="Open menu">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="3" y1="6" x2="21" y2="6"></line>
				<line x1="3" y1="12" x2="21" y2="12"></line>
				<line x1="3" y1="18" x2="21" y2="18"></line>
			</svg>
		</button>

		<!-- App title / branding -->
		<div class="app-branding" class:hidden={isSearchExpanded}>
			<h1 class="app-title">NullMaps</h1>
			<span class="app-subtitle">Tasmania</span>
		</div>

		<!-- Search interface -->
		<div class="search-container" class:expanded={isSearchExpanded}>
			{#if isSearchExpanded}
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search locations, properties..."
					class="search-input"
					onkeydown={handleSearchKeydown}
				/>
				<button class="search-close-button" onclick={toggleSearch} aria-label="Close search">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			{:else}
				<button class="search-button" onclick={toggleSearch} aria-label="Open search">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
					</svg>
				</button>
			{/if}
		</div>
	</div>
</header>

<style>
	.app-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.header-content {
		display: flex;
		align-items: center;
		height: 100%;
		padding: 0 16px;
		max-width: 100%;
	}

	.menu-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: none;
		border: none;
		border-radius: 8px;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.menu-button:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #1f2937;
	}

	.menu-button:active {
		background: rgba(0, 0, 0, 0.1);
		transform: scale(0.98);
	}

	.app-branding {
		display: flex;
		flex-direction: column;
		margin-left: 12px;
		flex: 1;
		transition: opacity 0.2s;
	}

	.app-branding.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.app-title {
		font-size: 20px;
		font-weight: 700;
		color: #1f2937;
		margin: 0;
		line-height: 1.2;
	}

	.app-subtitle {
		font-size: 12px;
		color: #6b7280;
		font-weight: 500;
		line-height: 1;
		margin-top: -2px;
	}

	.search-container {
		display: flex;
		align-items: center;
		transition: all 0.3s ease;
		flex-shrink: 0;
	}

	.search-container.expanded {
		flex: 1;
		margin-left: 12px;
	}

	.search-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: none;
		border: none;
		border-radius: 6px;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
	}

	.search-button:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #374151;
	}

	.search-input {
		flex: 1;
		height: 40px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		padding: 0 12px;
		font-size: 16px;
		background: white;
		color: #1f2937;
		outline: none;
		transition: border-color 0.2s;
	}

	.search-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.search-input::placeholder {
		color: #9ca3af;
	}

	.search-close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: none;
		border: none;
		border-radius: 6px;
		color: #6b7280;
		cursor: pointer;
		margin-left: 8px;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.search-close-button:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #374151;
	}

	/* Mobile optimizations */
	@media (max-width: 480px) {
		.header-content {
			padding: 0 12px;
		}

		.app-title {
			font-size: 18px;
		}

		.app-subtitle {
			font-size: 11px;
		}

		.search-input {
			font-size: 16px; /* Prevent zoom on iOS */
		}
	}

	/* Ensure the header doesn't interfere with map controls */
	@media (max-width: 768px) {
		.app-header {
			height: 56px;
		}
	}
</style>
