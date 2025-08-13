<script lang="ts">
	import { onMount } from 'svelte';
	import { activeDynamicLayerIds, dynamicLayers, mapStore } from '../../stores/mapStore.js';
	import {
		searchFeatures,
		createDebouncedSearch,
		type SearchResult
	} from '../../services/searchService.js';
	import SearchResults from '../search/SearchResults.svelte';
	import GoToCoordinate from './GoToCoordinate.svelte';

	interface Props {
		onMenuToggle?: () => void;
	}

	let { onMenuToggle = () => {} }: Props = $props();

	let isSearchExpanded = $state(false);
	let searchQuery = $state('');
	let searchResults: SearchResult[] = $state([]);
	let isSearching = $state(false);
	let searchError: string | null = $state(null);
	let showResults = $state(false);
	let searchInput: HTMLInputElement | undefined = $state();
	let isCoordinateDialogOpen = $state(false);

	// Create debounced search function
	const debouncedSearch = createDebouncedSearch(performSearch, 300);

	function toggleSearch() {
		isSearchExpanded = !isSearchExpanded;
		if (!isSearchExpanded) {
			clearSearch();
		} else {
			// Focus the input when search is expanded
			setTimeout(() => searchInput?.focus(), 100);
		}
	}

	function toggleCoordinateDialog() {
		isCoordinateDialogOpen = !isCoordinateDialogOpen;
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		searchError = null;
		showResults = false;
		isSearching = false;
	}

	async function performSearch(query: string) {
		if (!query.trim()) {
			clearSearch();
			return;
		}

		// Get active layers to search
		const activeLayersList = Array.from($activeDynamicLayerIds)
			.map((id) => $dynamicLayers.get(id))
			.filter((layer) => layer !== undefined);

		if (activeLayersList.length === 0) {
			searchError = 'No active layers to search. Please enable some feature layers first.';
			searchResults = [];
			showResults = true;
			isSearching = false;
			return;
		}

		isSearching = true;
		searchError = null;
		showResults = true;

		try {
			const response = await searchFeatures(activeLayersList, {
				text: query,
				maxResults: 5, // Limit results per layer
				returnGeometry: true,
				spatialReference: 4326 // Request coordinates in WGS84 for MapLibre
			});

			searchResults = response.results;
			isSearching = false;

			// Handle partial errors
			if (response.errors.length > 0) {
				console.warn('Some layers had search errors:', response.errors);

				// If we have results despite errors, show a warning
				if (response.results.length > 0) {
					const errorCount = response.errors.length;
					const totalLayers = activeLayersList.length;
					console.info(`Search completed with ${errorCount}/${totalLayers} layer errors`);
				} else {
					// No results and errors - show error message
					const errorMessages = response.errors
						.slice(0, 3) // Show max 3 error messages
						.map((err) => err.error)
						.join(', ');
					searchError = `Search errors: ${errorMessages}${response.errors.length > 3 ? '...' : ''}`;
					return;
				}
			}

			if (searchResults.length === 0) {
				searchError =
					response.errors.length > 0
						? 'No results found. Some layers had errors.'
						: 'No features found matching your search.';
			}
		} catch (error) {
			console.error('Search failed:', error);

			// Provide more specific error messages
			if (error instanceof Error) {
				if (error.message.includes('Network')) {
					searchError = 'Network error. Please check your connection and try again.';
				} else if (error.message.includes('timeout')) {
					searchError = 'Search timed out. Please try a more specific search term.';
				} else {
					searchError = `Search failed: ${error.message}`;
				}
			} else {
				searchError = 'Search failed. Please try again.';
			}

			searchResults = [];
			isSearching = false;
		}
	}

	function handleSearchInput() {
		debouncedSearch(searchQuery);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			// Prevent default form submission
			event.preventDefault();
			// If there's a single result, select it
			if (searchResults.length === 1) {
				handleResultClick(searchResults[0]);
			}
		} else if (event.key === 'Escape') {
			if (showResults && (searchResults.length > 0 || searchError)) {
				clearSearch();
			} else {
				toggleSearch();
			}
		}
	}

	function handleResultClick(result: SearchResult) {
		console.log('Selected feature:', result);
		// Update map store with selected result
		mapStore.selectSearchResult(result);
		mapStore.zoomToSearchResult(result);
		clearSearch();
		// Keep search expanded for potential next search
		// but clear results
	}

	// Close search results when clicking outside
	function handleDocumentClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const searchContainer = target.closest('.search-container');
		if (!searchContainer && showResults) {
			showResults = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleDocumentClick);
		return () => {
			document.removeEventListener('click', handleDocumentClick);
		};
	});
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
				<div class="search-input-wrapper">
					<input
						bind:this={searchInput}
						type="text"
						bind:value={searchQuery}
						placeholder="Search features in active layers..."
						class="search-input"
						class:loading={isSearching}
						onkeydown={handleSearchKeydown}
						oninput={handleSearchInput}
						autocomplete="off"
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

					{#if showResults}
						<SearchResults
							results={searchResults}
							loading={isSearching}
							error={searchError}
							query={searchQuery}
							onResultClick={handleResultClick}
							onClear={clearSearch}
						/>
					{/if}
				</div>
			{:else}
				<div class="action-buttons">
					<button class="coordinate-button" onclick={toggleCoordinateDialog} aria-label="Go to coordinates">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="4"></circle>
							<path d="M12 2v4"></path>
							<path d="M12 18v4"></path>
							<path d="M4.93 4.93l2.83 2.83"></path>
							<path d="M16.24 16.24l2.83 2.83"></path>
							<path d="M2 12h4"></path>
							<path d="M18 12h4"></path>
							<path d="M4.93 19.07l2.83-2.83"></path>
							<path d="M16.24 7.76l2.83-2.83"></path>
						</svg>
					</button>
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
				</div>
			{/if}
		</div>
	</div>
</header>

<!-- GoToCoordinate dialog -->
<GoToCoordinate isOpen={isCoordinateDialogOpen} onClose={() => (isCoordinateDialogOpen = false)} />

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

	.search-input-wrapper {
		position: relative;
		flex: 1;
		display: flex;
		align-items: center;
	}

	.action-buttons {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.coordinate-button,
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

	.coordinate-button:hover,
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

	.search-input.loading {
		background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="%23d1d5db" stroke-width="2"/><circle cx="8" cy="8" r="6" fill="none" stroke="%233b82f6" stroke-width="2" stroke-dasharray="18" stroke-dashoffset="18"><animateTransform attributeName="transform" type="rotate" values="0 8 8;360 8 8" dur="1s" repeatCount="indefinite"/></circle></svg>');
		background-repeat: no-repeat;
		background-position: right 40px center;
		padding-right: 60px;
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
