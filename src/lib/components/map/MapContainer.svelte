<script lang="ts">
	import { onMount } from 'svelte';
	import { MapLibre, RasterTileSource, RasterLayer } from 'svelte-maplibre';
	import type { Map as MapLibreMap } from 'maplibre-gl';
	import {
		mapStore,
		isLoading,
		error,
		activeDynamicLayerIds,
		dynamicLayers,
		currentBasemapStyle,
		mapState,
		clickQueryResults,
		clickQueryPanelVisible
	} from '../../stores/mapStore.js';
	import { TASMANIA_BOUNDS } from '../../config/listServices.js';
	import { queryFeaturesAtLocation } from '../../services/clickQueryService.js';
	import ClickQueryResults from './ClickQueryResults.svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let map: MapLibreMap | undefined = $state();
	let mapInitialized = $state(false); // Flag to prevent multiple initializations

	// Click query state (using modal for immediate results)
	let clickQueryLoading = $state(false);
	let clickQueryError: string | null = $state(null);
	let clickLocation: { x: number; y: number } | null = $state(null);

	function handleMapLoad() {
		if (!map || mapInitialized) return;

		mapInitialized = true;
		mapStore.setMap(map);

		// Wait for style to be fully loaded
		if (map.isStyleLoaded()) {
			completeMapInitialization();
		} else {
			map.once('styledata', completeMapInitialization);
		}

		// Add error handler
		map.on('error', handleMapError);
	}

	function completeMapInitialization() {
		if (!map || $mapState.isLoaded) return;

		mapStore.setLoaded(true);
		mapStore.setLoading(false); // Ensure loading state is cleared

		// Add click handler for feature info
		map.on('click', handleMapClick);

		console.log('Map successfully initialized');
	}

	// Watch for map changes and initialize when available
	$effect(() => {
		if (map && !mapInitialized && !$mapState.isLoaded) {
			// Use setTimeout to break the reactive cycle and prevent infinite loops
			setTimeout(() => {
				handleMapLoad();
			}, 0);
		}
	});

	async function handleMapClick(event: {
		lngLat: { lng: number; lat: number };
		point: [number, number];
	}) {
		if (!map || clickQueryLoading) return;

		const { lng, lat } = event.lngLat;

		// Reset previous results
		clickQueryError = null;
		clickLocation = { x: lng, y: lat };

		// Get active layers to query
		const activeLayers = Array.from($activeDynamicLayerIds)
			.map((layerId) => $dynamicLayers.get(layerId))
			.filter((layer) => layer !== undefined);

		// Debug: Log click information
		console.log(`🖱️ Map Click Debug:`, {
			clickLocation: `${lng}, ${lat}`,
			activeLayerIds: Array.from($activeDynamicLayerIds),
			activeLayers: activeLayers.map((layer) => ({
				id: layer.id,
				name: layer.name,
				serviceName: layer.serviceName,
				serviceUrl: layer.serviceUrl
			})),
			totalDynamicLayers: $dynamicLayers.size
		});

		if (activeLayers.length === 0) {
			clickQueryError = 'No active layers to query';
			// Auto-show panel when there are results or errors
			mapStore.setClickQueryResults([], { x: lng, y: lat });
			return;
		}

		// Show loading state immediately
		clickQueryLoading = true;

		try {
			const response = await queryFeaturesAtLocation(activeLayers, {
				geometry: { x: lng, y: lat },
				tolerance: 5,
				maxResults: 5,
				returnGeometry: true
			});

			// Store results persistently in the map store
			mapStore.setClickQueryResults(response.results, { x: lng, y: lat });

			// Handle any errors from individual layers
			if (response.errors.length > 0) {
				const errorMessages = response.errors.map((e) => `${e.layerId}: ${e.error}`);
				clickQueryError = `Some layers failed: ${errorMessages.join(', ')}`;
			}

			// If no results and no errors, show helpful message
			if (response.results.length === 0 && response.errors.length === 0) {
				clickQueryError = null; // Clear any previous errors - this isn't an error condition
			}
		} catch (error) {
			console.error('Click query failed:', error);
			clickQueryError = error instanceof Error ? error.message : 'Failed to query features';
			// Clear results on error
			mapStore.setClickQueryResults([], { x: lng, y: lat });
		} finally {
			clickQueryLoading = false;
		}
	}

	function handleMapError(event: unknown) {
		console.error('Map error:', event);

		// Check if this is an AbortError - these are usually harmless
		if (event && typeof event === 'object' && 'error' in event) {
			const errorObj = event.error as any;
			if (errorObj?.message?.includes('AbortError') || errorObj?.name === 'AbortError') {
				// AbortError is usually caused by rapid source changes, not a critical error
				console.warn('AbortError caught (usually harmless):', errorObj);
				return; // Don't show error UI for abort errors
			}

			// For other errors, show the error
			mapStore.setLoading(false);
			const errorMessage = `Map loading failed: ${errorObj.message || 'Unknown error'}`;
			mapStore.setError(errorMessage);
		} else {
			mapStore.setLoading(false);
			mapStore.setError('Failed to load map');
		}
	}

	function handleCloseResults() {
		mapStore.toggleClickQueryPanel(); // Close the panel
		clickQueryError = null;
		clickLocation = null;
	}

	onMount(() => {
		mapStore.setLoading(true);

		// Set a timeout to prevent infinite loading
		const loadingTimeout = setTimeout(() => {
			if ($isLoading && !$mapState.isLoaded) {
				console.warn('Map loading timeout reached');
				mapStore.setError('Map loading timed out. Please refresh the page.');
			}
		}, 10000); // 10 second timeout

		return () => {
			clearTimeout(loadingTimeout);
			if (map) {
				map.off('click', handleMapClick);
				map.off('error', handleMapError);
			}
			mapInitialized = false; // Reset flag on cleanup
		};
	});
</script>

<div class="map-container">
	{#if $isLoading}
		<div class="loading-overlay">
			<div class="loading-spinner"></div>
			<p class="loading-text">Loading Tasmania map...</p>
		</div>
	{/if}

	{#if $error}
		<div class="error-overlay">
			<div class="error-content">
				<h3>Map Error</h3>
				<p>{$error}</p>
				<button
					onclick={() => {
						mapStore.setError(null);
						mapStore.setLoading(true);
					}}
					class="retry-button"
				>
					Retry
				</button>
			</div>
		</div>
	{/if}

	<MapLibre
		style={$currentBasemapStyle}
		center={TASMANIA_BOUNDS.center}
		zoom={6}
		class="maplibre-map"
		attributionControl={false}
		cooperativeGestures={false}
		dragRotate={true}
		pitch={0}
		projection={{ type: 'globe' }}
		diffStyleUpdates={true}
		bind:map
	>
		{#if $mapState.isLoaded}
			<!-- Dynamic layers from LIST services -->
			{#each Array.from($activeDynamicLayerIds) as layerId (layerId)}
				{@const layer = $dynamicLayers.get(layerId)}
				{#if layer}
					{@const exportUrl = `${layer.serviceUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&layers=show:${layer.layerId}&layerDefs=&size=256%2C256&imageSR=3857&format=png&transparent=true&dpi=96&time=&layerTimeOptions=&dynamicLayers=&gdbVersion=&mapScale=&rotation=&datumTransformations=&layerParameterValues=&mapRangeValues=&layerRangeValues=&f=image`}

					<RasterTileSource id={`${layerId}-source`} tiles={[exportUrl]} tileSize={256}>
						<RasterLayer
							id={layerId}
							paint={{
								'raster-opacity': 0.8
							}}
						/>
					</RasterTileSource>
				{/if}
			{/each}
		{/if}
	</MapLibre>

	<!-- Click query results modal -->
	{#if $clickQueryPanelVisible}
		<ClickQueryResults
			results={$clickQueryResults}
			loading={clickQueryLoading}
			error={clickQueryError}
			{clickLocation}
			onClose={handleCloseResults}
		/>
	{/if}
</div>

<style>
	.map-container {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	:global(.maplibre-map) {
		width: 100%;
		height: 100%;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(255, 255, 255, 0.9);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f4f6;
		border-top: 4px solid #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	.loading-text {
		color: #374151;
		font-size: 16px;
		font-weight: 500;
	}

	.error-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(239, 68, 68, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.error-content {
		background: white;
		padding: 24px;
		border-radius: 8px;
		text-align: center;
		max-width: 320px;
		margin: 16px;
	}

	.error-content h3 {
		color: #dc2626;
		margin: 0 0 12px 0;
		font-size: 18px;
		font-weight: 600;
	}

	.error-content p {
		color: #374151;
		margin: 0 0 16px 0;
		font-size: 14px;
	}

	.retry-button {
		background: #2563eb;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.retry-button:hover {
		background: #1d4ed8;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		:global(.maplibre-ctrl-attrib) {
			font-size: 10px;
		}

		:global(.maplibre-ctrl-logo) {
			display: none;
		}
	}
</style>
