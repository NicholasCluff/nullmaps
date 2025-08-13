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
	dynamicLayerOpacities: Map<string, number>; // Track opacity for each layer
	dynamicLayerVisibilities: Map<string, boolean>; // Track visibility for each layer
	favoriteLayerIds: Set<string>;
	layersLoading: boolean;
	// Searchable field selections per layer
	layerSearchableFields: Map<string, Set<string>>; // layerId -> Set of field names
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
	dynamicLayerOpacities: Array<[string, number]>; // Persist layer opacities as array of [layerId, opacity]
	dynamicLayerVisibilities: Array<[string, boolean]>; // Persist layer visibilities as array of [layerId, visible]
	favoriteLayerIds: string[];
	layerSearchableFields: Array<[string, string[]]>; // Persist searchable fields as array of [layerId, fieldNames]
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
	dynamicLayerOpacities: new Map(savedState?.dynamicLayerOpacities || []),
	dynamicLayerVisibilities: new Map(savedState?.dynamicLayerVisibilities || []),
	favoriteLayerIds: initialFavoriteLayerIds,
	layersLoading: false,
	// Searchable field selections per layer
	layerSearchableFields: new Map(
		savedState?.layerSearchableFields?.map(([layerId, fields]) => [layerId, new Set(fields)]) || []
	),
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
export const dynamicLayerOpacities = derived(mapState, ($state) => $state.dynamicLayerOpacities);
export const dynamicLayerVisibilities = derived(mapState, ($state) => $state.dynamicLayerVisibilities);
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
export const layerSearchableFields = derived(mapState, ($state) => $state.layerSearchableFields);

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
	toggleLayer(...args: unknown[]) {
		// For backwards compatibility - basemaps now use setBasemap()
		console.warn('toggleLayer is deprecated, use setBasemap() for basemap changes', args);
	},

	setLayerOpacity(...args: unknown[]) {
		// For backwards compatibility - basemaps opacity is handled by the style
		console.warn('setLayerOpacity is deprecated for basemaps', args);
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

			// Initialize opacity and visibility if not already set
			const newOpacities = new Map(state.dynamicLayerOpacities);
			const newVisibilities = new Map(state.dynamicLayerVisibilities);
			if (!newOpacities.has(layerId)) {
				newOpacities.set(layerId, 0.8); // Default opacity
			}
			if (!newVisibilities.has(layerId)) {
				newVisibilities.set(layerId, true); // Default visible
			}

			const newState = {
				...state,
				activeDynamicLayerIds: newActiveDynamicLayerIds,
				dynamicLayerOrder: newDynamicLayerOrder,
				dynamicLayerOpacities: newOpacities,
				dynamicLayerVisibilities: newVisibilities
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

		// Check if this is a basemap service
		const isBasemapLayer =
			layer.type === 'Basemap Layer' || layer.serviceName.startsWith('Basemaps/');

		// Determine if this is a vector or raster layer based on geometry type
		const isVectorLayer =
			layer.geometryType &&
			['esriGeometryPoint', 'esriGeometryPolyline', 'esriGeometryPolygon'].includes(
				layer.geometryType
			);

		// Add source if it doesn't exist
		if (!map.getSource(sourceId)) {
			if (isBasemapLayer) {
				// Basemap services use tile server format for better performance
				const tileUrl = `${layer.serviceUrl}/tile/{z}/{x}/{y}`;
				map.addSource(sourceId, {
					type: 'raster',
					tiles: [tileUrl],
					tileSize: 256
				});
			} else if (isVectorLayer) {
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
			// Get stored opacity and visibility or use defaults
			const storedOpacity = currentState.dynamicLayerOpacities.get(layerId) || 0.8;
			const isVisible = currentState.dynamicLayerVisibilities.get(layerId) !== false;

			// Find proper insertion point for consistent layer positioning
			const insertionPoint = this.findDynamicLayerInsertionPoint(map);

			// Both vector (WMS) and raster layers are now added as raster layers
			// since WMS renders vector data as images server-side
			map.addLayer(
				{
					id: layerId,
					type: 'raster',
					source: sourceId,
					paint: {
						'raster-opacity': storedOpacity
					},
					layout: {
						'visibility': isVisible ? 'visible' : 'none'
					}
				},
				insertionPoint
			);

		}
	},

	setDynamicLayerOpacity(layerId: string, opacity: number) {
		const clampedOpacity = Math.max(0, Math.min(1, opacity));

		// Update state first
		mapState.update((state) => {
			const newOpacities = new Map(state.dynamicLayerOpacities);
			newOpacities.set(layerId, clampedOpacity);
			return {
				...state,
				dynamicLayerOpacities: newOpacities
			};
		});

		// Update map layer if it exists
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (map && map.getLayer(layerId)) {
			// All layers are now raster layers (WMS renders vector data as images)
			map.setPaintProperty(layerId, 'raster-opacity', clampedOpacity);
		}

		// Save to localStorage
		setTimeout(() => this.saveState(), 0);
	},

	setDynamicLayerVisibility(layerId: string, visible: boolean) {
		// Update state first
		mapState.update((state) => {
			const newVisibilities = new Map(state.dynamicLayerVisibilities);
			newVisibilities.set(layerId, visible);
			return {
				...state,
				dynamicLayerVisibilities: newVisibilities
			};
		});

		// Update map layer if it exists
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (map && map.getLayer(layerId)) {
			map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
		}

		// Save to localStorage
		setTimeout(() => this.saveState(), 0);
	},

	// Helper function to find appropriate insertion point for dynamic layers
	findDynamicLayerInsertionPoint(map: MapLibreMap): string | undefined {
		const mapLayers = map.getStyle().layers;
		
		// For CartoDB basemaps, look for specific layer types to insert before
		// Priority order: place labels > POI labels > road labels > other symbol layers > line layers
		
		// Look for place labels first (highest priority)
		const placeLayer = mapLayers.find(
			(layer) =>
				layer.type === 'symbol' &&
				layer.id.includes('place_')
		);
		
		if (placeLayer) {
			return placeLayer.id;
		}
		
		// Then look for POI labels
		const poiLayer = mapLayers.find(
			(layer) =>
				layer.type === 'symbol' &&
				layer.id.includes('poi_')
		);
		
		if (poiLayer) {
			return poiLayer.id;
		}
		
		// Then road name labels
		const roadLayer = mapLayers.find(
			(layer) =>
				layer.type === 'symbol' &&
				layer.id.includes('roadname_')
		);
		
		if (roadLayer) {
			return roadLayer.id;
		}

		// Fallback: find first non-background layer that's not one of our dynamic layers
		const fallbackLayer = mapLayers.find(
			(layer) =>
				layer.type !== 'background' &&
				!layer.id.endsWith('-source') &&
				!mapLayers.some((l) => l.id === `${layer.id}-source`) // Not one of our dynamic layers
		);

		if (fallbackLayer) {
			return fallbackLayer.id;
		}
		
		return undefined;
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

			// Find the insertion point for all dynamic layers
			const insertionPoint = this.findDynamicLayerInsertionPoint(map);

			// Re-add layers in the new order (bottom to top)
			// First layer in newOrder should be at the bottom, last should be at the top
			newOrder.forEach((layerId) => {
				const layer = state.dynamicLayers.get(layerId);
				if (layer && state.activeDynamicLayerIds.has(layerId)) {
					const sourceId = `${layerId}-source`;

					// Add source if it doesn't exist
					if (!map.getSource(sourceId)) {
						// Check if this is a basemap service
						const isBasemapLayer =
							layer.type === 'Basemap Layer' || layer.serviceName.startsWith('Basemaps/');

						if (isBasemapLayer) {
							// Basemap services use tile server format
							const tileUrl = `${layer.serviceUrl}/tile/{z}/{x}/{y}`;
							map.addSource(sourceId, {
								type: 'raster',
								tiles: [tileUrl],
								tileSize: 256
							});
						} else {
							// Regular LIST service layers
							const exportUrl = `${layer.serviceUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&layers=show:${layer.layerId}&layerDefs=&size=256%2C256&imageSR=3857&format=png&transparent=true&dpi=96&time=&layerTimeOptions=&dynamicLayers=&gdbVersion=&mapScale=&rotation=&datumTransformations=&layerParameterValues=&mapRangeValues=&layerRangeValues=&f=image`;

							map.addSource(sourceId, {
								type: 'raster',
								tiles: [exportUrl],
								tileSize: 256
							});
						}
					}

					// Add layer with proper insertion point
					if (!map.getLayer(layerId)) {
						// Get stored opacity and visibility or use defaults
						const storedOpacity = state.dynamicLayerOpacities.get(layerId) || 0.8;
						const isVisible = state.dynamicLayerVisibilities.get(layerId) !== false;

						map.addLayer(
							{
								id: layerId,
								type: 'raster',
								source: sourceId,
								paint: {
									'raster-opacity': storedOpacity
								},
								layout: {
									'visibility': isVisible ? 'visible' : 'none'
								}
							},
							insertionPoint // Use consistent insertion point for all layers
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
		
		// Add all search results with geometry to the map
		this.addSearchResultsToMap(results);
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

	// Add multiple search results to the map with enhanced geometry support
	addSearchResultsToMap(results: SearchResult[]) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		if (!map) return;

		// Remove existing search result layers
		this.clearSearchResultsFromMap();

		// Filter results that have geometry
		const resultsWithGeometry = results.filter(result => result.geometry);
		if (resultsWithGeometry.length === 0) return;

		// Create GeoJSON feature collection
		const features = resultsWithGeometry.map((result, index) => {
			const geometry = this.convertToGeoJSONGeometry(result.geometry!);
			return {
				type: 'Feature' as const,
				id: `search-result-${index}`,
				geometry,
				properties: {
					resultId: result.id,
					name: result.displayName || 'Search Result',
					layerName: result.layerName,
					serviceName: result.serviceName,
					matchedField: result.matchedField,
					matchedValue: result.matchedValue,
					attributes: result.attributes,
					geometryType: result.geometry!.type
				}
			};
		});

		const featureCollection = {
			type: 'FeatureCollection' as const,
			features
		};

		// Add sources and layers for different geometry types
		this.addSearchResultLayers(map, featureCollection);
	},

	// Convert SearchResult geometry to GeoJSON geometry
	convertToGeoJSONGeometry(geometry: SearchResult['geometry']): any {
		if (!geometry) return null;

		switch (geometry.type) {
			case 'Point':
				return {
					type: 'Point',
					coordinates: geometry.coordinates
				};
			case 'Polyline':
				return {
					type: 'MultiLineString',
					coordinates: geometry.coordinates
				};
			case 'Polygon':
				return {
					type: 'Polygon',
					coordinates: geometry.coordinates
				};
			default:
				return null;
		}
	},

	// Add search result layers to the map for different geometry types
	addSearchResultLayers(map: any, featureCollection: any) {
		const sourceId = 'search-results-source';

		// Add the main source
		map.addSource(sourceId, {
			type: 'geojson',
			data: featureCollection
		});

		// Add layers for different geometry types
		// Points - show as circle markers
		map.addLayer({
			id: 'search-results-points',
			type: 'circle',
			source: sourceId,
			filter: ['==', ['get', 'geometryType'], 'Point'],
			paint: {
				'circle-radius': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					12,
					8
				],
				'circle-color': '#ef4444',
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 2,
				'circle-opacity': 0.8
			}
		});

		// Points - labels
		map.addLayer({
			id: 'search-results-labels',
			type: 'symbol',
			source: sourceId,
			filter: ['==', ['get', 'geometryType'], 'Point'],
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
				'text-size': 12,
				'text-offset': [0, -2],
				'text-anchor': 'bottom'
			},
			paint: {
				'text-color': '#1f2937',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1
			}
		});

		// Lines - show as highlighted lines
		map.addLayer({
			id: 'search-results-lines',
			type: 'line',
			source: sourceId,
			filter: ['==', ['get', 'geometryType'], 'Polyline'],
			paint: {
				'line-color': '#ef4444',
				'line-width': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					6,
					4
				],
				'line-opacity': 0.8
			}
		});

		// Polygons - show as filled with outline
		map.addLayer({
			id: 'search-results-polygons',
			type: 'fill',
			source: sourceId,
			filter: ['==', ['get', 'geometryType'], 'Polygon'],
			paint: {
				'fill-color': '#ef4444',
				'fill-opacity': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					0.4,
					0.2
				]
			}
		});

		// Polygon outlines
		map.addLayer({
			id: 'search-results-polygon-outlines',
			type: 'line',
			source: sourceId,
			filter: ['==', ['get', 'geometryType'], 'Polygon'],
			paint: {
				'line-color': '#dc2626',
				'line-width': [
					'case',
					['boolean', ['feature-state', 'hover'], false],
					3,
					2
				],
				'line-opacity': 0.9
			}
		});

		// Add interactivity
		this.addSearchResultsInteractivity(map);
	},

	// Add hover and click interactions for search results
	addSearchResultsInteractivity(map: any) {
		const layerIds = [
			'search-results-points',
			'search-results-lines', 
			'search-results-polygons',
			'search-results-polygon-outlines'
		];

		layerIds.forEach(layerId => {
			// Mouse enter - set hover state and cursor
			map.on('mouseenter', layerId, (e: any) => {
				if (e.features.length > 0) {
					map.getCanvas().style.cursor = 'pointer';
					map.setFeatureState(
						{ source: 'search-results-source', id: e.features[0].id },
						{ hover: true }
					);
				}
			});

			// Mouse leave - remove hover state and cursor
			map.on('mouseleave', layerId, (e: any) => {
				if (e.features.length > 0) {
					map.getCanvas().style.cursor = '';
					map.setFeatureState(
						{ source: 'search-results-source', id: e.features[0].id },
						{ hover: false }
					);
				}
			});

			// Click - show detailed popup
			map.on('click', layerId, (e: any) => {
				if (e.features && e.features[0]) {
					this.showSearchResultPopup(map, e.features[0], e.lngLat);
				}
			});
		});
	},

	// Show detailed popup for search result feature
	showSearchResultPopup(map: any, feature: any, lngLat: any) {
		const props = feature.properties;
		
		// Create popup content with enhanced details
		const popupContent = this.createSearchResultPopupContent(props);
		
		// Create a simple popup using MapLibre's Popup
		try {
			// Import MapLibre Popup dynamically
			import('maplibre-gl').then(({ Popup }) => {
				const popup = new Popup({ 
					closeButton: true,
					closeOnClick: true,
					maxWidth: '300px'
				})
					.setLngLat(lngLat)
					.setHTML(popupContent)
					.addTo(map);
			}).catch(() => {
				// Fallback to console logging if Popup is not available
				console.log('Search result clicked:', {
					name: props.name,
					layerName: props.layerName,
					matchedField: props.matchedField,
					matchedValue: props.matchedValue,
					coordinates: lngLat
				});
			});
		} catch (error) {
			// Fallback to console logging if dynamic import fails
			console.log('Search result details:', {
				name: props.name,
				layerName: props.layerName,
				matchedField: props.matchedField,
				matchedValue: props.matchedValue,
				coordinates: lngLat
			});
		}
	},

	// Create HTML content for search result popup
	createSearchResultPopupContent(properties: any): string {
		const {
			name,
			layerName,
			serviceName,
			matchedField,
			matchedValue,
			attributes
		} = properties;

		let content = `
			<div style="
				background: white;
				padding: 12px;
				border-radius: 6px;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				font-size: 14px;
				line-height: 1.4;
				max-width: 280px;
			">
				<div style="
					font-weight: 600;
					color: #1f2937;
					margin-bottom: 8px;
					font-size: 15px;
				">${name || 'Search Result'}</div>
		`;

		// Add matched field information if available
		if (matchedField && matchedValue && matchedValue !== name) {
			content += `
				<div style="
					margin-bottom: 8px;
					padding: 6px 8px;
					background: #f0fdf4;
					border-radius: 4px;
					border-left: 3px solid #059669;
				">
					<div style="color: #059669; font-weight: 500; font-size: 13px;">
						Matched: ${matchedValue}
					</div>
					<div style="color: #6b7280; font-size: 12px;">
						Field: ${matchedField}
					</div>
				</div>
			`;
		}

		// Add layer information
		content += `
			<div style="
				display: flex;
				gap: 6px;
				flex-wrap: wrap;
				margin-bottom: 8px;
			">
				<span style="
					background: #eff6ff;
					color: #2563eb;
					padding: 2px 6px;
					border-radius: 3px;
					font-size: 11px;
					font-weight: 500;
				">${layerName}</span>
				<span style="
					background: #f3f4f6;
					color: #6b7280;
					padding: 2px 6px;
					border-radius: 3px;
					font-size: 11px;
				">${serviceName}</span>
			</div>
		`;

		// Add key attributes (limit to most relevant ones)
		if (attributes && typeof attributes === 'object') {
			const relevantFields = ['OBJECTID', 'ID', 'NAME', 'TYPE', 'STATUS', 'DESCRIPTION'].slice(0, 3);
			const shownFields = relevantFields.filter(field => 
				attributes[field] != null && attributes[field] !== name && attributes[field] !== matchedValue
			);

			if (shownFields.length > 0) {
				content += `
					<div style="
						border-top: 1px solid #e5e7eb;
						padding-top: 8px;
						margin-top: 8px;
					">
				`;
				
				shownFields.forEach(field => {
					content += `
						<div style="margin-bottom: 4px; font-size: 12px;">
							<span style="color: #6b7280;">${field}:</span>
							<span style="color: #1f2937; margin-left: 4px;">${attributes[field]}</span>
						</div>
					`;
				});
				
				content += '</div>';
			}
		}

		content += '</div>';
		return content;
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
					const geometry = feature.geometry as { type: string; coordinates: number[] };
					const coordinates = geometry.coordinates.slice();
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
					// Popup element is created but not currently used in DOM
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

		// Remove all search result layers (both old and new)
		const layerIds = [
			'search-result-layer', // Legacy single result layer
			'search-results-points',
			'search-results-labels',
			'search-results-lines',
			'search-results-polygons',
			'search-results-polygon-outlines'
		];

		const sourceIds = [
			'search-result-source', // Legacy single result source
			'search-results-source' // New multiple results source
		];

		// Remove layers
		layerIds.forEach(layerId => {
			if (map.getLayer(layerId)) {
				map.removeLayer(layerId);
			}
		});

		// Remove sources
		sourceIds.forEach(sourceId => {
			if (map.getSource(sourceId)) {
				map.removeSource(sourceId);
			}
		});
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
			dynamicLayerOpacities: Array.from(currentState.dynamicLayerOpacities.entries()),
			dynamicLayerVisibilities: Array.from(currentState.dynamicLayerVisibilities.entries()),
			favoriteLayerIds: Array.from(currentState.favoriteLayerIds),
			layerSearchableFields: Array.from(currentState.layerSearchableFields.entries()).map(
				([layerId, fields]) => [layerId, Array.from(fields)]
			),
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

	// Searchable field management
	setLayerSearchableFields(layerId: string, fieldNames: Set<string>) {
		mapState.update((state) => {
			const newSearchableFields = new Map(state.layerSearchableFields);
			newSearchableFields.set(layerId, new Set(fieldNames));
			return {
				...state,
				layerSearchableFields: newSearchableFields
			};
		});
		// Save to localStorage
		setTimeout(() => this.saveState(), 0);
	},

	toggleFieldSearchable(layerId: string, fieldName: string) {
		mapState.update((state) => {
			const newSearchableFields = new Map(state.layerSearchableFields);
			const currentFields = newSearchableFields.get(layerId) || new Set();

			if (currentFields.has(fieldName)) {
				currentFields.delete(fieldName);
			} else {
				currentFields.add(fieldName);
			}

			newSearchableFields.set(layerId, currentFields);
			return {
				...state,
				layerSearchableFields: newSearchableFields
			};
		});
		// Save to localStorage
		setTimeout(() => this.saveState(), 0);
	},

	getLayerSearchableFields(layerId: string): Set<string> {
		const currentState = this.getCurrentState();
		return currentState.layerSearchableFields.get(layerId) || new Set();
	},

	// Clear all stored state (useful for debugging)
	clearStoredState() {
		if (typeof window !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY);
			console.log('🗑️ Cleared stored map state from localStorage');
		}
	},

	// Add coordinate marker to map
	addCoordinateMarker(longitude: number, latitude: number, coordinateInfo: string) {
		const currentState = this.getCurrentState();
		if (!currentState.map) return;

		const map = currentState.map;
		
		// Remove any existing coordinate marker
		this.clearCoordinateMarker();

		const sourceId = 'coordinate-marker-source';
		const layerId = 'coordinate-marker-layer';

		// Add source for the coordinate marker
		map.addSource(sourceId, {
			type: 'geojson',
			data: {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [longitude, latitude]
				},
				properties: {
					coordinates: coordinateInfo,
					type: 'coordinate-marker'
				}
			}
		});

		// Add marker layer with distinct styling
		map.addLayer({
			id: layerId,
			type: 'circle',
			source: sourceId,
			paint: {
				'circle-radius': 10,
				'circle-color': '#10b981', // Emerald green
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 3,
				'circle-opacity': 0.9
			}
		});

		// Add popup on click
		map.on('click', layerId, (e) => {
			if (e.features && e.features[0]) {
				const feature = e.features[0];
				const coordinates = feature.properties?.coordinates || 'Coordinate Location';
				
				// Create popup content
				const popupHtml = `
					<div style="padding: 8px; font-family: system-ui, sans-serif;">
						<h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #1f2937;">
							📍 Coordinate Location
						</h4>
						<p style="margin: 0; font-size: 12px; color: #6b7280;">
							${coordinates}
						</p>
					</div>
				`;

				// Create and show popup (simple implementation)
				const popup = document.createElement('div');
				popup.innerHTML = popupHtml;
				popup.style.cssText = `
					position: absolute;
					background: white;
					border-radius: 6px;
					box-shadow: 0 4px 12px rgba(0,0,0,0.15);
					pointer-events: none;
					z-index: 1000;
					max-width: 200px;
				`;
				
				document.body.appendChild(popup);
				
				// Position popup near the click
				const rect = map.getContainer().getBoundingClientRect();
				popup.style.left = (e.originalEvent.clientX - rect.left) + 'px';
				popup.style.top = (e.originalEvent.clientY - rect.top - 60) + 'px';
				
				// Remove popup after 3 seconds
				setTimeout(() => {
					if (popup.parentNode) {
						popup.parentNode.removeChild(popup);
					}
				}, 3000);
			}
		});

		// Change cursor on hover
		map.on('mouseenter', layerId, () => {
			map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', layerId, () => {
			map.getCanvas().style.cursor = '';
		});
	},

	// Clear coordinate marker from map
	clearCoordinateMarker() {
		const currentState = this.getCurrentState();
		if (!currentState.map) return;

		const map = currentState.map;
		const sourceId = 'coordinate-marker-source';
		const layerId = 'coordinate-marker-layer';

		// Remove layer and source if they exist
		if (map.getLayer(layerId)) {
			map.removeLayer(layerId);
		}
		if (map.getSource(sourceId)) {
			map.removeSource(sourceId);
		}
	}
};
