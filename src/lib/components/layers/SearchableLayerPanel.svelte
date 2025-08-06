<script lang="ts">
	import { onMount } from 'svelte';
	import {
		mapStore,
		activeBasemap,
		activeDynamicLayerIds,
		favoriteLayerIds,
		layersLoading
	} from '../../stores/mapStore.js';
	import { BASEMAP_STYLES, type BasemapId } from '../../config/listServices.js';
	import {
		loadAllLayers,
		searchLayers,
		groupLayersByService,
		type SearchableLayer
	} from '../../services/listService.js';

	type TabType = 'basemaps' | 'list' | 'favorites';

	let activeTab: TabType = 'basemaps';
	let expandedGroups = ['basemaps']; // Basemaps expanded by default
	let searchQuery = '';
	let allDynamicLayers: SearchableLayer[] = [];
	let filteredLayers: SearchableLayer[] = [];
	let groupedLayers: Map<string, SearchableLayer[]> = new Map();
	let loadingError: string | null = null;

	// Load dynamic layers on mount
	onMount(async () => {
		// Prevent multiple calls if already loading or loaded
		if ($layersLoading || allDynamicLayers.length > 0) {
			return;
		}

		try {
			mapStore.setLayersLoading(true);
			allDynamicLayers = await loadAllLayers();
			mapStore.setDynamicLayers(allDynamicLayers);
			updateFilteredLayers();
		} catch (error) {
			console.error('Failed to load dynamic layers:', error);
			loadingError = error instanceof Error ? error.message : 'Failed to load layers';
		} finally {
			mapStore.setLayersLoading(false);
		}
	});

	// Update filtered layers when search query, tab, or favorites change
	$: updateFilteredLayers(searchQuery, activeTab, allDynamicLayers, $favoriteLayerIds);

	function updateFilteredLayers(
		query = searchQuery,
		tab = activeTab,
		layers = allDynamicLayers,
		favorites = $favoriteLayerIds
	) {
		if (tab !== 'list' && tab !== 'favorites') {
			filteredLayers = [];
			groupedLayers = new Map();
			return;
		}

		if (tab === 'favorites') {
			// Show only favorite layers
			filteredLayers = layers.filter((layer) => favorites.has(layer.id));
		} else {
			filteredLayers = searchLayers(layers, query);
		}

		groupedLayers = groupLayersByService(filteredLayers);
	}

	function switchTab(tab: TabType) {
		activeTab = tab;
		searchQuery = ''; // Clear search when switching tabs
	}

	function toggleGroup(groupId: string) {
		if (expandedGroups.includes(groupId)) {
			expandedGroups = expandedGroups.filter((id) => id !== groupId);
		} else {
			expandedGroups = [...expandedGroups, groupId];
		}
	}

	function handleBasemapChange(basemapId: BasemapId) {
		mapStore.setBasemap(basemapId);
	}

	function handleDynamicLayerToggle(layerId: string) {
		mapStore.toggleDynamicLayer(layerId);
	}

	function handleDynamicOpacityChange(layerId: string, event: Event) {
		const target = event.target as HTMLInputElement;
		const opacity = parseFloat(target.value);
		mapStore.setDynamicLayerOpacity(layerId, opacity);
	}

	function isBasemapActive(basemapId: BasemapId): boolean {
		return $activeBasemap === basemapId;
	}

	function isDynamicLayerActive(layerId: string): boolean {
		return $activeDynamicLayerIds.has(layerId);
	}

	function clearSearch() {
		searchQuery = '';
	}

	// Calculate active layer counts
	$: basemapActiveCount = 1; // Always one active basemap
	$: dynamicActiveCount = $activeDynamicLayerIds.size;
	$: favoritesCount = $favoriteLayerIds.size;
</script>

<div class="layer-panel">
	<div class="panel-header">
		<h3>Map Layers</h3>

		<!-- Three-tab navigation -->
		<div class="tab-navigation">
			<button
				class="tab-button"
				class:active={activeTab === 'basemaps'}
				onclick={() => switchTab('basemaps')}
			>
				Base ({basemapActiveCount})
			</button>
			<button
				class="tab-button"
				class:active={activeTab === 'list'}
				onclick={() => switchTab('list')}
			>
				LIST ({dynamicActiveCount})
			</button>
			<button
				class="tab-button"
				class:active={activeTab === 'favorites'}
				onclick={() => switchTab('favorites')}
				class:has-favorites={favoritesCount > 0}
			>
				★ {favoritesCount}
			</button>
		</div>
	</div>

	<!-- Search interface for LIST layers -->
	{#if activeTab === 'list'}
		<div class="search-section">
			<div class="search-input-container">
				<svg
					class="search-icon"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="11" cy="11" r="8"></circle>
					<path d="m21 21-4.35-4.35"></path>
				</svg>
				<input
					type="text"
					placeholder="Search layers..."
					bind:value={searchQuery}
					class="search-input"
				/>
				{#if searchQuery}
					<button class="clear-search" onclick={clearSearch} aria-label="Clear search">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				{/if}
			</div>

			{#if searchQuery}
				<div class="search-results-info">
					{filteredLayers.length} layers found
				</div>
			{/if}
		</div>
	{/if}

	<!-- Content based on active tab -->
	{#if activeTab === 'basemaps'}
		<!-- Basemap layers -->
		<div class="layer-groups">
			<div class="layer-group">
				<div class="layer-list">
					{#each Object.values(BASEMAP_STYLES) as basemap (basemap.id)}
						<div class="layer-item compact">
							<div class="layer-control">
								<label class="layer-toggle">
									<input
										type="radio"
										name="basemap"
										checked={isBasemapActive(basemap.id)}
										onchange={() => handleBasemapChange(basemap.id)}
									/>
									<span class="radio-custom"></span>
									<span class="layer-name">{basemap.name}</span>
								</label>
							</div>
							{#if basemap.description}
								<div class="layer-description">
									{basemap.description}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else if activeTab === 'list'}
		<!-- Loading state for dynamic layers -->
		{#if $layersLoading}
			<div class="loading-section">
				<div class="loading-spinner-small"></div>
				<p>Loading LIST services...</p>
			</div>
		{:else if loadingError}
			<div class="error-section">
				<p class="error-message">{loadingError}</p>
				<button class="retry-button-small" onclick={() => window.location.reload()}> Retry </button>
			</div>
		{:else}
			<!-- Dynamic layers grouped by service -->
			<div class="layer-groups dynamic-layers">
				{#each Array.from(groupedLayers.entries()) as [serviceName, serviceLayers] (serviceName)}
					<div class="layer-group">
						<button
							class="group-header"
							class:expanded={expandedGroups.includes(serviceName)}
							onclick={() => toggleGroup(serviceName)}
							aria-expanded={expandedGroups.includes(serviceName)}
						>
							<div class="group-info">
								<h4 class="group-name">{serviceName.replace('Public/', '')}</h4>
								<p class="group-description">{serviceLayers.length} layers</p>
							</div>
							<svg
								class="expand-icon"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="6,9 12,15 18,9"></polyline>
							</svg>
						</button>

						{#if expandedGroups.includes(serviceName)}
							<div class="layer-list">
								{#each serviceLayers as layer (layer.id)}
									<div class="layer-item">
										<div class="layer-control">
											<label class="layer-toggle">
												<input
													type="checkbox"
													checked={isDynamicLayerActive(layer.id)}
													onchange={() => handleDynamicLayerToggle(layer.id)}
												/>
												<span class="checkbox-custom"></span>
												<span class="layer-name">{layer.name}</span>
											</label>

											<div class="layer-actions">
												<button
													class="favorite-button"
													class:favorited={$favoriteLayerIds.has(layer.id)}
													onclick={() => mapStore.toggleLayerFavorite(layer.id)}
													aria-label={$favoriteLayerIds.has(layer.id)
														? 'Remove from favorites'
														: 'Add to favorites'}
												>
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
													>
														<polygon
															points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
														></polygon>
													</svg>
												</button>

												<div class="layer-meta">
													<span class="layer-type">{layer.type}</span>
													{#if layer.geometryType}
														<span class="geometry-type"
															>{layer.geometryType.replace('esriGeometry', '')}</span
														>
													{/if}
												</div>
											</div>
										</div>

										{#if layer.description}
											<div class="layer-description">
												{layer.description}
											</div>
										{/if}

										{#if isDynamicLayerActive(layer.id)}
											<div class="opacity-control">
												<div class="opacity-label">
													<span>Opacity</span>
													<span class="opacity-value">80%</span>
												</div>
												<input
													type="range"
													min="0"
													max="1"
													step="0.1"
													value="0.8"
													oninput={(e) => handleDynamicOpacityChange(layer.id, e)}
													class="opacity-slider"
													aria-label="Layer opacity"
												/>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'favorites'}
		<!-- Favorites tab -->
		{#if favoritesCount === 0}
			<div class="empty-favorites">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<polygon
						points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
					></polygon>
				</svg>
				<p>No favorite layers</p>
				<span>Star layers in the LIST tab to add them here</span>
			</div>
		{:else}
			<!-- Favorite layers grouped by service -->
			<div class="layer-groups">
				{#each Array.from(groupedLayers.entries()) as [serviceName, serviceLayers] (serviceName)}
					<div class="layer-group">
						<div class="group-header-compact">
							<h4 class="group-name compact">{serviceName.replace('Public/', '')}</h4>
						</div>
						<div class="layer-list">
							{#each serviceLayers as layer (layer.id)}
								<div class="layer-item compact">
									<div class="layer-control">
										<label class="layer-toggle">
											<input
												type="checkbox"
												checked={isDynamicLayerActive(layer.id)}
												onchange={() => handleDynamicLayerToggle(layer.id)}
											/>
											<span class="checkbox-custom"></span>
											<span class="layer-name">{layer.name}</span>
										</label>
										<button
											class="favorite-button favorited"
											onclick={() => mapStore.toggleLayerFavorite(layer.id)}
											aria-label="Remove from favorites"
										>
											<svg
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="currentColor"
												stroke="currentColor"
												stroke-width="2"
											>
												<polygon
													points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
												></polygon>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<div class="panel-footer">
		<div class="service-info">
			<p class="service-note">Data from Tasmania's Land Information System (LIST)</p>
			<a
				href="https://www.thelist.tas.gov.au"
				target="_blank"
				rel="noopener noreferrer"
				class="service-link"
			>
				Learn more about LIST services
			</a>
		</div>
	</div>
</div>

<style>
	.layer-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: white;
		flex-shrink: 0;
	}

	.panel-header h3 {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 4px 0;
	}

	.panel-description {
		font-size: 14px;
		color: #6b7280;
		margin: 0 0 16px 0;
	}

	.tab-navigation {
		display: flex;
		gap: 2px;
		background: #f3f4f6;
		border-radius: 8px;
		padding: 3px;
	}

	.tab-button {
		flex: 1;
		padding: 6px 8px;
		background: transparent;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tab-button.active {
		background: white;
		color: #1f2937;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.tab-button.has-favorites {
		color: #f59e0b;
	}

	.tab-button.has-favorites.active {
		background: #fef3c7;
		color: #92400e;
	}

	.search-section {
		padding: 16px 20px;
		border-bottom: 1px solid #e5e7eb;
		background: white;
		flex-shrink: 0;
	}

	.search-input-container {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 12px;
		color: #9ca3af;
		z-index: 1;
	}

	.search-input {
		width: 100%;
		padding: 10px 12px 10px 40px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 14px;
		background: white;
		transition: border-color 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.clear-search {
		position: absolute;
		right: 8px;
		padding: 4px;
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		border-radius: 4px;
		transition: color 0.2s;
	}

	.clear-search:hover {
		color: #6b7280;
	}

	.search-results-info {
		margin-top: 8px;
		font-size: 12px;
		color: #6b7280;
	}

	.favorites-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid #e5e7eb;
	}

	.favorites-filter {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #fef3c7;
		border: 1px solid #fbbf24;
		border-radius: 6px;
		color: #92400e;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.favorites-filter:hover {
		background: #fef3c7;
		border-color: #f59e0b;
	}

	.favorites-filter.active {
		background: #f59e0b;
		color: white;
		border-color: #f59e0b;
	}

	.favorites-filter.active svg {
		fill: currentColor;
	}

	.loading-section,
	.error-section {
		padding: 40px 20px;
		text-align: center;
		color: #6b7280;
	}

	.loading-spinner-small {
		width: 24px;
		height: 24px;
		border: 2px solid #f3f4f6;
		border-top: 2px solid #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 12px;
	}

	.error-message {
		color: #dc2626;
		margin-bottom: 12px;
	}

	.retry-button-small {
		padding: 6px 12px;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		cursor: pointer;
	}

	.layer-groups {
		flex: 1;
		overflow-y: auto;
	}

	.dynamic-layers {
		background: #fafafa;
	}

	.layer-group {
		border-bottom: 1px solid #e5e7eb;
	}

	.group-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: none;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		text-align: left;
	}

	.group-header:hover {
		background: #f9fafb;
	}

	.group-header.expanded {
		background: #f3f4f6;
	}

	.group-info {
		flex: 1;
	}

	.group-name {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 2px 0;
	}

	.group-name.compact {
		font-size: 14px;
		margin: 0;
	}

	.group-header-compact {
		padding: 8px 20px;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.group-description {
		font-size: 13px;
		color: #6b7280;
		margin: 0;
		line-height: 1.3;
	}

	.expand-icon {
		color: #9ca3af;
		transition: transform 0.2s;
		flex-shrink: 0;
		margin-left: 12px;
	}

	.group-header.expanded .expand-icon {
		transform: rotate(180deg);
	}

	.layer-list {
		background: #fafafa;
	}

	.layer-item {
		padding: 12px 20px 12px 40px;
		border-top: 1px solid #e5e7eb;
	}

	.layer-item.compact {
		padding: 8px 20px 8px 20px;
	}

	.layer-control {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.layer-toggle {
		display: flex;
		align-items: flex-start;
		cursor: pointer;
		flex: 1;
		margin-right: 12px;
	}

	.layer-toggle input[type='checkbox'],
	.layer-toggle input[type='radio'] {
		display: none;
	}

	.checkbox-custom,
	.radio-custom {
		width: 18px;
		height: 18px;
		border: 2px solid #d1d5db;
		margin-right: 12px;
		margin-top: 2px;
		position: relative;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.checkbox-custom {
		border-radius: 4px;
	}

	.radio-custom {
		border-radius: 50%;
	}

	.layer-toggle input[type='checkbox']:checked + .checkbox-custom,
	.layer-toggle input[type='radio']:checked + .radio-custom {
		background: #2563eb;
		border-color: #2563eb;
	}

	.layer-toggle input[type='checkbox']:checked + .checkbox-custom::after {
		content: '';
		position: absolute;
		top: 1px;
		left: 5px;
		width: 4px;
		height: 8px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.layer-toggle input[type='radio']:checked + .radio-custom::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: white;
	}

	.layer-name {
		font-size: 14px;
		color: #374151;
		font-weight: 500;
		line-height: 1.4;
	}

	.layer-actions {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		flex-shrink: 0;
	}

	.favorite-button {
		padding: 4px;
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		color: #9ca3af;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.favorite-button:hover {
		border-color: #fbbf24;
		color: #f59e0b;
		background: #fef3c7;
	}

	.favorite-button.favorited {
		border-color: #f59e0b;
		color: #f59e0b;
		background: #fef3c7;
	}

	.favorite-button.favorited svg {
		fill: currentColor;
	}

	.layer-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}

	.layer-type,
	.geometry-type {
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 3px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.layer-type {
		background: #eff6ff;
		color: #1d4ed8;
	}

	.geometry-type {
		background: #f0fdf4;
		color: #166534;
	}

	.layer-description {
		font-size: 12px;
		color: #6b7280;
		line-height: 1.4;
		margin-bottom: 8px;
		padding-left: 30px;
	}

	.basemap-indicator {
		flex-shrink: 0;
	}

	.basemap-badge {
		background: #f3f4f6;
		color: #6b7280;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.opacity-control {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #e5e7eb;
		padding-left: 30px;
	}

	.opacity-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #6b7280;
		margin-bottom: 8px;
	}

	.opacity-value {
		font-weight: 600;
		color: #374151;
	}

	.opacity-slider {
		width: 100%;
		height: 4px;
		background: #e5e7eb;
		border-radius: 2px;
		outline: none;
		appearance: none;
		cursor: pointer;
	}

	.opacity-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		cursor: pointer;
	}

	.opacity-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		border: none;
		cursor: pointer;
	}

	.panel-footer {
		padding: 20px;
		border-top: 1px solid #e5e7eb;
		background: white;
		flex-shrink: 0;
	}

	.service-info {
		text-align: center;
	}

	.service-note {
		font-size: 12px;
		color: #6b7280;
		margin: 0 0 8px 0;
		line-height: 1.4;
	}

	.service-link {
		color: #2563eb;
		text-decoration: none;
		font-size: 12px;
		font-weight: 500;
	}

	.service-link:hover {
		text-decoration: underline;
	}

	/* Scrollbar styling */
	.layer-groups::-webkit-scrollbar {
		width: 4px;
	}

	.layer-groups::-webkit-scrollbar-track {
		background: transparent;
	}

	.layer-groups::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.layer-groups::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}

	.empty-favorites {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
		color: #9ca3af;
	}

	.empty-favorites svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-favorites p {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 500;
		color: #6b7280;
	}

	.empty-favorites span {
		font-size: 14px;
		line-height: 1.4;
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.panel-header {
			padding: 16px;
		}

		.tab-navigation {
			gap: 1px;
			padding: 2px;
		}

		.tab-button {
			padding: 4px 6px;
			font-size: 11px;
			min-height: 28px;
		}

		.search-section {
			padding: 12px 16px;
		}

		.layer-item {
			padding: 8px 16px 8px 24px;
		}

		.layer-item.compact {
			padding: 6px 16px;
		}

		.layer-name {
			font-size: 13px;
		}

		.group-header {
			padding: 12px 16px;
		}

		.group-header-compact {
			padding: 6px 16px;
		}

		.panel-footer {
			padding: 16px;
		}
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
