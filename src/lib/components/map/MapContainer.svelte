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
		mapState
	} from '../../stores/mapStore.js';
	import { TASMANIA_BOUNDS } from '../../config/listServices.js';
	import 'maplibre-gl/dist/maplibre-gl.css';

	let map: MapLibreMap | undefined;

	function handleMapLoad() {
		if (!map) return;

		mapStore.setMap(map);
		mapStore.setLoaded(true);

		// Add click handler for feature info
		map.on('click', handleMapClick);

		// Add error handler
		map.on('error', handleMapError);
	}

	// Watch for map changes and initialize when available
	$: if (map && !$mapStore.isLoaded) {
		handleMapLoad();
	}

	function handleMapClick(event: { point: [number, number] }) {
		if (!map) return;
		const features = map.queryRenderedFeatures(event.point);
		if (features.length > 0) {
			// TODO: Implement feature info panel
			console.log('Clicked features:', features);
		}
	}

	function handleMapError(event: unknown) {
		console.error('Map error:', event);
	}

	onMount(() => {
		mapStore.setLoading(true);

		return () => {
			if (map) {
				map.off('click', handleMapClick);
			}
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
