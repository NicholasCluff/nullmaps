import { writable, derived } from 'svelte/store';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
	TASMANIA_BOUNDS,
	SERVICE_GROUPS,
	BASEMAP_STYLES,
	DEFAULT_BASEMAP,
	type LayerConfig,
	type BasemapId
} from '../config/listServices.js';
import type { SearchableLayer } from '../services/listService.js';
import type { SearchResult } from '../services/searchService.js';
import type { ClickQueryResult } from '../services/clickQueryService.js';

interface MapState {
	map: MapLibreMap | null;
	isLoaded: boolean;
	isLoading: boolean;
	error: string | null;
	center: [number, number];
	zoom: number;
	bearing: number;
	// Declarative basemap handling
	activeBasemap: BasemapId;
	// Legacy layer system (to be phased out)
	layers: Map<string, LayerConfig>;
	activeLayerIds: Set<string>;
	// Dynamic layers from LIST services
	dynamicLayers: Map<string, SearchableLayer>;
	activeDynamicLayerIds: Set<string>;
	dynamicLayerOrder: string[]; // Track layer rendering order (bottom to top)
	favoriteLayerIds: Set<string>;
	layersLoading: boolean;
	// Search state
	searchResults: SearchResult[];
	selectedSearchResult: SearchResult | null;
	searchResultsVisible: boolean;
	// Click query results state
	clickQueryResults: ClickQueryResult[];
	clickQueryLocation: { x: number; y: number } | null;
	clickQueryTimestamp: number | null;
	clickQueryPanelVisible: boolean;
}

interface PersistedMapState {
	activeBasemap: BasemapId;
	activeLayerIds: string[];
	activeDynamicLayerIds: string[];
	dynamicLayerOrder: string[];
	favoriteLayerIds: string[];
	center: [number, number];
	zoom: number;
	bearing: number;
}

// localStorage utilities
const STORAGE_KEY = 'nullmaps-state';

function saveStateToStorage(state: PersistedMapState): void {
	if (typeof window === 'undefined') return; // Skip on server
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (error) {
		console.warn('Failed to save map state to localStorage:', error);
	}
}

function loadStateFromStorage(): Partial<PersistedMapState> | null {
	if (typeof window === 'undefined') return null; // Skip on server
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return saved ? JSON.parse(saved) : null;
	} catch (error) {
		console.warn('Failed to load map state from localStorage:', error);
		return null;
	}
}

// Initialize layer configurations with saved state
function initializeLayers(): {
	layers: Map<string, LayerConfig>;
	activeLayerIds: Set<string>;
	favoriteLayerIds: Set<string>;
} {
	const layers = new Map<string, LayerConfig>();
	const activeLayerIds = new Set<string>();
	const favoriteLayerIds = new Set<string>();

	// Load saved state
	const savedState = loadStateFromStorage();

	SERVICE_GROUPS.forEach((group) => {
		group.layers.forEach((layer) => {
			layers.set(layer.id, { ...layer });
			// Use default visibility if no saved state
			if (layer.visible && !savedState) {
				activeLayerIds.add(layer.id);
			}
		});
	});

	// Apply saved state if available
	if (savedState) {
		// Clear default selections when applying saved state
		activeLayerIds.clear();
		savedState.activeLayerIds?.forEach((id) => {
			if (layers.has(id)) {
				activeLayerIds.add(id);
			}
		});
		savedState.favoriteLayerIds?.forEach((id) => favoriteLayerIds.add(id));
	}

	return { layers, activeLayerIds, favoriteLayerIds };
}

const {
	layers: initialLayers,
	activeLayerIds: initialActiveLayerIds,
	favoriteLayerIds: initialFavoriteLayerIds
} = initializeLayers();

// Load saved state for initialization
const savedState = loadStateFromStorage();

// Create reactive map state using Svelte stores
const mapState = writable<MapState>({
	map: null,
	isLoaded: false,
	isLoading: false,
	error: null,
	center: savedState?.center || TASMANIA_BOUNDS.center,
	zoom: savedState?.zoom || TASMANIA_BOUNDS.zoom,
	bearing: savedState?.bearing || 0,
	// Declarative basemap handling
	activeBasemap: savedState?.activeBasemap || DEFAULT_BASEMAP,
	// Legacy layer system
	layers: initialLayers,
	activeLayerIds: initialActiveLayerIds,
	dynamicLayers: new Map(),
	activeDynamicLayerIds: new Set(savedState?.activeDynamicLayerIds || []),
	dynamicLayerOrder: savedState?.dynamicLayerOrder || [],
	favoriteLayerIds: initialFavoriteLayerIds,
	layersLoading: false,
	// Search state
	searchResults: [],
	selectedSearchResult: null,
	searchResultsVisible: false,
	// Click query results state
	clickQueryResults: [],
	clickQueryLocation: null,
	clickQueryTimestamp: null,
	clickQueryPanelVisible: false
});

// Export the main state store
export { mapState };

// Create derived stores for reactive access
export const map = derived(mapState, ($state) => $state.map);
export const isLoaded = derived(mapState, ($state) => $state.isLoaded);
export const isLoading = derived(mapState, ($state) => $state.isLoading);
export const error = derived(mapState, ($state) => $state.error);
export const center = derived(mapState, ($state) => $state.center);
export const zoom = derived(mapState, ($state) => $state.zoom);
export const bearing = derived(mapState, ($state) => $state.bearing);
export const layers = derived(mapState, ($state) => $state.layers);
export const activeLayerIds = derived(mapState, ($state) => $state.activeLayerIds);
export const dynamicLayers = derived(mapState, ($state) => $state.dynamicLayers);
export const activeDynamicLayerIds = derived(mapState, ($state) => $state.activeDynamicLayerIds);
export const dynamicLayerOrder = derived(mapState, ($state) => $state.dynamicLayerOrder);
export const favoriteLayerIds = derived(mapState, ($state) => $state.favoriteLayerIds);
export const layersLoading = derived(mapState, ($state) => $state.layersLoading);
export const searchResults = derived(mapState, ($state) => $state.searchResults);
export const selectedSearchResult = derived(mapState, ($state) => $state.selectedSearchResult);
export const searchResultsVisible = derived(mapState, ($state) => $state.searchResultsVisible);
export const clickQueryResults = derived(mapState, ($state) => $state.clickQueryResults);
export const clickQueryLocation = derived(mapState, ($state) => $state.clickQueryLocation);
export const clickQueryTimestamp = derived(mapState, ($state) => $state.clickQueryTimestamp);
export const clickQueryPanelVisible = derived(mapState, ($state) => $state.clickQueryPanelVisible);
export const activeBasemap = derived(mapState, ($state) => $state.activeBasemap);

// Derive the current basemap style URL
export const currentBasemapStyle = derived(
	activeBasemap,
	($activeBasemap) => BASEMAP_STYLES[$activeBasemap].url
);

// Map management functions
export const mapStore = {
	// Subscribe to the store
	subscribe: mapState.subscribe,

	// Map instance management
	setMap(map: MapLibreMap | null) {
		mapState.update((state) => {
			const newState = { ...state, map };
			if (map && !state.map) {
				// Only add event listener if we don't already have a map
				// Update state when map moves or rotates (debounced to prevent loops)
				let moveTimeout: ReturnType<typeof setTimeout>;
				map.on('move', () => {
					clearTimeout(moveTimeout);
					moveTimeout = setTimeout(() => {
						if (map.isStyleLoaded()) {
							const center = map.getCenter();
							mapState.update((s) => ({
								...s,
								center: [center.lng, center.lat] as [number, number],
								zoom: map.getZoom(),
								bearing: map.getBearing()
							}));

							// Save to localStorage (debounced separately)
							this.saveState();
						}
					}, 100);
				});
			}
			return newState;
		});
	},

	setLoading(loading: boolean) {
		mapState.update((state) => ({ ...state, isLoading: loading }));
	},

	setLoaded(loaded: boolean) {
		mapState.update((state) => {
			const newState = {
				...state,
				isLoaded: loaded,
				isLoading: loaded ? false : state.isLoading,
				error: loaded ? null : state.error
			};

			// When map is loaded, initialize active dynamic layers
			// Basemaps are handled declaratively by MapContainer
			if (loaded && state.map) {
				setTimeout(() => {
					// Add all active dynamic layers
					for (const layerId of state.activeDynamicLayerIds) {
						this.addDynamicLayerToMap(layerId);
					}
				}, 0);
			}

			return newState;
		});
	},

	setError(error: string | null) {
		mapState.update((state) => ({ ...state, error, isLoading: false }));
	},

	// Legacy layer management (kept for compatibility during transition)
	// Note: Basemaps are now handled declaratively via the style attribute
	toggleLayer(layerId: string) {
		// For backwards compatibility - basemaps now use setBasemap()
		console.warn('toggleLayer is deprecated, use setBasemap() for basemap changes');
	},

	setLayerOpacity(layerId: string, opacity: number) {
		// For backwards compatibility - basemaps opacity is handled by the style
		console.warn('setLayerOpacity is deprecated for basemaps');
	},

	// Helper to get current state synchronously
	getCurrentState(): MapState {
		let currentState: MapState;
		mapState.subscribe((state) => (currentState = state))();
		return currentState!;
	},

	// Navigation helpers
	flyTo(center: [number, number], zoom?: number) {
		const currentState = this.getCurrentState();
		if (!currentState.map) return;

		currentState.map.flyTo({
			center,
			zoom: zoom ?? currentState.zoom,
			duration: 1000
		});
	},

	fitToBounds(bounds: [[number, number], [number, number]]) {
		const currentState = this.getCurrentState();
		if (!currentState.map) return;

		currentState.map.fitBounds(bounds, {
			padding: 20,
			duration: 1000
		});
	},

	resetToTasmania() {
		this.flyTo(TASMANIA_BOUNDS.center, TASMANIA_BOUNDS.zoom);
	},

	resetBearing() {
		const currentState = this.getCurrentState();
		if (!currentState.map) return;

		currentState.map.easeTo({
			bearing: 0,
			pitch: 0,
			duration: 800
		});
	},

	// Current location
	getUserLocation(): Promise<[number, number]> {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error('Geolocation not supported'));
				return;
			}

			navigator.geolocation.getCurrentPosition(
				(position) => {
					const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
					resolve(coords);
				},
				(error) => {
					reject(error);
				},
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 300000 // 5 minutes
				}
			);
		});
	},

	async goToUserLocation() {
		try {
			const coords = await this.getUserLocation();
			this.flyTo(coords, 15); // Zoom in when going to user location
		} catch (error) {
			this.setError(
				`Unable to get location: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	},

	// Dynamic layer management
	setLayersLoading(loading: boolean) {
		mapState.update((state) => ({ ...state, layersLoading: loading }));
	},

	setDynamicLayers(layers: SearchableLayer[]) {
		mapState.update((state) => {
			const dynamicLayers = new Map<string, SearchableLayer>();
			layers.forEach((layer) => {
				dynamicLayers.set(layer.id, layer);
			});
			return { ...state, dynamicLayers };
		});
	},

	toggleDynamicLayer(layerId: string) {
		mapState.update((state) => {
			const layer = state.dynamicLayers.get(layerId);
			if (!layer) return state;

			const newActiveDynamicLayerIds = new Set(state.activeDynamicLayerIds);
			let newDynamicLayerOrder = [...state.dynamicLayerOrder];

			if (state.activeDynamicLayerIds.has(layerId)) {
				// Remove layer
				newActiveDynamicLayerIds.delete(layerId);
				newDynamicLayerOrder = newDynamicLayerOrder.filter((id) => id !== layerId);
			} else {
				// Add layer - append to end (will render on top)
				newActiveDynamicLayerIds.add(layerId);
				if (!newDynamicLayerOrder.includes(layerId)) {
					newDynamicLayerOrder.push(layerId);
				}
			}

			const newState = {
				...state,
				activeDynamicLayerIds: newActiveDynamicLayerIds,
				dynamicLayerOrder: newDynamicLayerOrder
			};

			// Update map if available
			if (state.map && state.isLoaded) {
				setTimeout(() => this.updateDynamicMapLayer(layerId), 0);
			}

			// Save to localStorage
			setTimeout(() => this.saveState(), 0);

			return newState;
		});
	},

	updateDynamicMapLayer(layerId: string) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		const layer = currentState.dynamicLayers.get(layerId);
		if (!map || !layer) return;

		const mapLayerExists = map.getLayer(layerId);
		const sourceId = `${layerId}-source`;

		if (currentState.activeDynamicLayerIds.has(layerId) && !mapLayerExists) {
			// Add layer to map
			this.addDynamicLayerToMap(layerId);
		} else if (!currentState.activeDynamicLayerIds.has(layerId) && mapLayerExists) {
			// Remove layer from map
			map.removeLayer(layerId);
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId);
			}
		}
	},

	addDynamicLayerToMap(layerId: string) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		const layer = currentState.dynamicLayers.get(layerId);
		if (!map || !layer) return;

		const sourceId = `${layerId}-source`;

		// Determine if this is a vector or raster layer based on geometry type
		const isVectorLayer =
			layer.geometryType &&
			['esriGeometryPoint', 'esriGeometryPolyline', 'esriGeometryPolygon'].includes(
				layer.geometryType
			);

		// Add source if it doesn't exist
		if (!map.getSource(sourceId)) {
			if (isVectorLayer) {
				// Use WMS endpoint for feature layers - renders vector data as images server-side
				const wmsUrl = `${layer.serviceUrl}/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=true&LAYERS=${layer.layerId}&CRS=EPSG%3A3857&STYLES=&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;
				map.addSource(sourceId, {
					type: 'raster',
					tiles: [wmsUrl],
					tileSize: 256
				});
			} else {
				// Add as raster source for image-based layers
				const tileUrl = `${layer.serviceUrl}/tile/${layer.layerId}/{z}/{y}/{x}`;
				map.addSource(sourceId, {
					type: 'raster',
					tiles: [tileUrl],
					tileSize: 256
				});
			}
		}

		// Add layer if it doesn't exist
		if (!map.getLayer(layerId)) {
			// Both vector (WMS) and raster layers are now added as raster layers
			// since WMS renders vector data as images server-side
			map.addLayer({
				id: layerId,
				type: 'raster',
				source: sourceId,
				paint: {
					'raster-opacity': 0.8
				}
			});
		}
	},

	setDynamicLayerOpacity(layerId: string, opacity: number) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (!map || !map.getLayer(layerId)) return;

		// All layers are now raster layers (WMS renders vector data as images)
		map.setPaintProperty(layerId, 'raster-opacity', Math.max(0, Math.min(1, opacity)));
	},

	reorderDynamicLayers(newOrder: string[]) {
		mapState.update((state) => {
			if (!state.map) return state;

			const map = state.map;

			// Update the layer order in state
			const newState = {
				...state,
				dynamicLayerOrder: newOrder
			};

			// Remove all dynamic layers from map
			const currentLayers = Array.from(state.activeDynamicLayerIds);
			currentLayers.forEach((layerId) => {
				if (map.getLayer(layerId)) {
					map.removeLayer(layerId);
				}
			});

			// Re-add layers in the new order (bottom to top)
			// First layer in newOrder should be at the bottom, last should be at the top
			newOrder.forEach((layerId) => {
				const layer = state.dynamicLayers.get(layerId);
				if (layer && state.activeDynamicLayerIds.has(layerId)) {
					// Find the first feature layer to insert before it
					const mapLayers = map.getStyle().layers;
					const firstFeatureLayerId = mapLayers.find(
						(l) => l.id.includes('_') && l.id !== layerId
					)?.id;

					const sourceId = `${layerId}-source`;

					// Add source if it doesn't exist
					if (!map.getSource(sourceId)) {
						const exportUrl = `${layer.serviceUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&layers=show:${layer.layerId}&layerDefs=&size=256%2C256&imageSR=3857&format=png&transparent=true&dpi=96&time=&layerTimeOptions=&dynamicLayers=&gdbVersion=&mapScale=&rotation=&datumTransformations=&layerParameterValues=&mapRangeValues=&layerRangeValues=&f=image`;

						map.addSource(sourceId, {
							type: 'raster',
							tiles: [exportUrl],
							tileSize: 256
						});
					}

					// Add layer
					if (!map.getLayer(layerId)) {
						map.addLayer(
							{
								id: layerId,
								type: 'raster',
								source: sourceId,
								paint: {
									'raster-opacity': 0.8
								}
							},
							firstFeatureLayerId
						);
					}
				}
			});

			// Save state after reordering
			setTimeout(() => this.saveState(), 0);

			return newState;
		});
	},

	// Favorites management
	toggleLayerFavorite(layerId: string) {
		mapState.update((state) => {
			const newFavoriteLayerIds = new Set(state.favoriteLayerIds);

			if (newFavoriteLayerIds.has(layerId)) {
				newFavoriteLayerIds.delete(layerId);
			} else {
				newFavoriteLayerIds.add(layerId);
			}

			const newState = {
				...state,
				favoriteLayerIds: newFavoriteLayerIds
			};

			// Save to localStorage
			this.saveState();

			return newState;
		});
	},

	isLayerFavorite(layerId: string): boolean {
		const currentState = this.getCurrentState();
		return currentState.favoriteLayerIds.has(layerId);
	},

	// Search management
	setSearchResults(results: SearchResult[]) {
		mapState.update((state) => ({
			...state,
			searchResults: results,
			searchResultsVisible: results.length > 0
		}));
	},

	selectSearchResult(result: SearchResult | null) {
		mapState.update((state) => ({
			...state,
			selectedSearchResult: result
		}));

		// Add search result marker to map if a result is selected
		if (result && result.geometry) {
			this.addSearchResultToMap(result);
		} else {
			this.clearSearchResultsFromMap();
		}
	},

	setSearchResultsVisible(visible: boolean) {
		mapState.update((state) => ({
			...state,
			searchResultsVisible: visible
		}));
	},

	clearSearchResults() {
		mapState.update((state) => ({
			...state,
			searchResults: [],
			selectedSearchResult: null,
			searchResultsVisible: false
		}));
		this.clearSearchResultsFromMap();
	},

	addSearchResultToMap(result: SearchResult) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (!map || !result.geometry) return;

		// Remove existing search result layers
		this.clearSearchResultsFromMap();

		const sourceId = 'search-result-source';
		const layerId = 'search-result-layer';

		// Add source for the search result
		if (result.geometry.type === 'Point') {
			const [lng, lat] = result.geometry.coordinates as [number, number];

			map.addSource(sourceId, {
				type: 'geojson',
				data: {
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [lng, lat]
					},
					properties: {
						name: result.displayName || 'Search Result',
						layerName: result.layerName
					}
				}
			});

			// Add marker layer
			map.addLayer({
				id: layerId,
				type: 'circle',
				source: sourceId,
				paint: {
					'circle-radius': 8,
					'circle-color': '#ef4444',
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2
				}
			});

			// Add popup on click
			map.on('click', layerId, (e) => {
				if (e.features && e.features[0]) {
					const feature = e.features[0];
					const coordinates = (feature.geometry as any).coordinates.slice();
					const name = feature.properties?.name || 'Search Result';
					const layerName = feature.properties?.layerName || '';

					// Create a simple popup using native browser APIs for now
					// This avoids import issues with MapLibre GL popup
					const popupElement = document.createElement('div');
					popupElement.innerHTML = `
						<div style="
							background: white;
							padding: 8px 12px;
							border-radius: 6px;
							box-shadow: 0 2px 8px rgba(0,0,0,0.15);
							font-size: 14px;
							max-width: 200px;
							position: absolute;
							z-index: 1000;
							transform: translate(-50%, -100%);
							margin-top: -10px;
							pointer-events: none;
						">
							<strong>${name}</strong>
							${layerName ? `<br><small style="color: #666;">From: ${layerName}</small>` : ''}
						</div>
					`;

					// For now, just log the popup content - we'll improve this later
					console.log('Search result clicked:', { name, layerName, coordinates });
				}
			});

			// Change cursor on hover
			map.on('mouseenter', layerId, () => {
				map.getCanvas().style.cursor = 'pointer';
			});

			map.on('mouseleave', layerId, () => {
				map.getCanvas().style.cursor = '';
			});
		}
	},

	clearSearchResultsFromMap() {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (!map) return;

		const sourceId = 'search-result-source';
		const layerId = 'search-result-layer';

		// Remove layer and source if they exist
		if (map.getLayer(layerId)) {
			map.removeLayer(layerId);
		}
		if (map.getSource(sourceId)) {
			map.removeSource(sourceId);
		}
	},

	// Zoom to search result
	zoomToSearchResult(result: SearchResult) {
		if (result.bbox) {
			const [minX, minY, maxX, maxY] = result.bbox;
			this.fitToBounds([
				[minX, minY],
				[maxX, maxY]
			]);
		} else if (result.geometry?.type === 'Point') {
			const [lng, lat] = result.geometry.coordinates as [number, number];

			// Validate coordinates
			if (isNaN(lng) || isNaN(lat) || !isFinite(lng) || !isFinite(lat)) {
				console.error('Invalid search result coordinates:', {
					lng,
					lat,
					result: result.displayName
				});
				return;
			}

			// Check if coordinates are in reasonable range for Tasmania
			if (lng < 140 || lng > 155 || lat < -45 || lat > -38) {
				console.warn('Search result coordinates outside Tasmania bounds:', {
					lng,
					lat,
					result: result.displayName
				});
			}

			this.flyTo([lng, lat], 16);
		}
	},

	// Basemap management
	setBasemap(basemapId: BasemapId) {
		mapState.update((state) => ({
			...state,
			activeBasemap: basemapId
		}));

		// Save to localStorage
		setTimeout(() => this.saveState(), 0);
	},

	// State persistence
	saveState() {
		const currentState = this.getCurrentState();
		const persistedState: PersistedMapState = {
			activeBasemap: currentState.activeBasemap,
			activeLayerIds: Array.from(currentState.activeLayerIds),
			activeDynamicLayerIds: Array.from(currentState.activeDynamicLayerIds),
			dynamicLayerOrder: currentState.dynamicLayerOrder,
			favoriteLayerIds: Array.from(currentState.favoriteLayerIds),
			center: currentState.center,
			zoom: currentState.zoom,
			bearing: currentState.bearing
		};
		saveStateToStorage(persistedState);
	},

	// Click query results management
	setClickQueryResults(results: ClickQueryResult[], location: { x: number; y: number }) {
		mapState.update((state) => ({
			...state,
			clickQueryResults: results,
			clickQueryLocation: location,
			clickQueryTimestamp: Date.now(),
			clickQueryPanelVisible: results.length > 0 // Auto-show panel if there are results
		}));
	},

	toggleClickQueryPanel() {
		mapState.update((state) => ({
			...state,
			clickQueryPanelVisible: !state.clickQueryPanelVisible
		}));
	},

	clearClickQueryResults() {
		mapState.update((state) => ({
			...state,
			clickQueryResults: [],
			clickQueryLocation: null,
			clickQueryTimestamp: null,
			clickQueryPanelVisible: false
		}));
	},

	// Clear all stored state (useful for debugging)
	clearStoredState() {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
			console.log('🗑️ Cleared stored map state from localStorage');
		}
	}
};
