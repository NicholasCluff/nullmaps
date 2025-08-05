import { writable, derived } from 'svelte/store';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { TASMANIA_BOUNDS, SERVICE_GROUPS, type LayerConfig } from '../config/listServices.js';
import type { SearchableLayer } from '../services/listService.js';

interface MapState {
	map: MapLibreMap | null;
	isLoaded: boolean;
	isLoading: boolean;
	error: string | null;
	center: [number, number];
	zoom: number;
	bearing: number;
	layers: Map<string, LayerConfig>;
	activeLayerIds: Set<string>;
	// Dynamic layers from LIST services
	dynamicLayers: Map<string, SearchableLayer>;
	activeDynamicLayerIds: Set<string>;
	dynamicLayerOrder: string[]; // Track layer rendering order (bottom to top)
	favoriteLayerIds: Set<string>;
	layersLoading: boolean;
}

interface PersistedMapState {
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
	layers: initialLayers,
	activeLayerIds: initialActiveLayerIds,
	dynamicLayers: new Map(),
	activeDynamicLayerIds: new Set(savedState?.activeDynamicLayerIds || []),
	dynamicLayerOrder: savedState?.dynamicLayerOrder || [],
	favoriteLayerIds: initialFavoriteLayerIds,
	layersLoading: false
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

// Map management functions
export const mapStore = {
	// Subscribe to the store
	subscribe: mapState.subscribe,

	// Map instance management
	setMap(map: MapLibreMap | null) {
		mapState.update((state) => {
			const newState = { ...state, map };
			if (map) {
				// Update state when map moves or rotates
				map.on('move', () => {
					const center = map.getCenter();
					mapState.update((s) => {
						const newState = {
							...s,
							center: [center.lng, center.lat] as [number, number],
							zoom: map.getZoom(),
							bearing: map.getBearing()
						};

						// Save to localStorage
						this.saveState();

						return newState;
					});
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

	// Layer management
	toggleLayer(layerId: string) {
		mapState.update((state) => {
			const layer = state.layers.get(layerId);
			if (!layer) return state;

			const newLayers = new Map(state.layers);
			const newActiveLayerIds = new Set(state.activeLayerIds);

			// Check if this is a basemap layer (CartoDB layers)
			const isBasemap = layerId.startsWith('carto-');

			if (isBasemap) {
				// For basemaps, use radio button behavior - only one active at a time
				// First deactivate all other basemaps
				for (const [id, l] of state.layers) {
					if (id.startsWith('carto-') && id !== layerId) {
						newActiveLayerIds.delete(id);
						l.visible = false;
						newLayers.set(id, { ...l });
					}
				}

				// Then activate the selected basemap
				newActiveLayerIds.add(layerId);
				layer.visible = true;
			} else {
				// For non-basemap layers, use checkbox behavior
				if (state.activeLayerIds.has(layerId)) {
					newActiveLayerIds.delete(layerId);
					layer.visible = false;
				} else {
					newActiveLayerIds.add(layerId);
					layer.visible = true;
				}
			}

			newLayers.set(layerId, { ...layer });

			const newState = {
				...state,
				layers: newLayers,
				activeLayerIds: newActiveLayerIds
			};

			// Update map if available (only for non-basemap layers)
			// Basemaps are handled declaratively by MapContainer
			if (state.map && state.isLoaded && !layerId.startsWith('carto-')) {
				setTimeout(() => this.updateMapLayer(layerId), 0);
			}

			// Save to localStorage
			setTimeout(() => this.saveState(), 0);

			return newState;
		});
	},

	setLayerOpacity(layerId: string, opacity: number) {
		mapState.update((state) => {
			const layer = state.layers.get(layerId);
			if (!layer) return state;

			const newLayers = new Map(state.layers);
			const updatedLayer = { ...layer, opacity: Math.max(0, Math.min(1, opacity)) };
			newLayers.set(layerId, updatedLayer);

			const newState = { ...state, layers: newLayers };

			// Update map if available
			if (state.map && state.isLoaded) {
				setTimeout(() => this.updateMapLayer(layerId), 0);
			}

			return newState;
		});
	},

	updateMapLayer(layerId: string) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		const layer = currentState.layers.get(layerId);
		if (!map || !layer) return;

		const mapLayerExists = map.getLayer(layerId);

		if (layer.visible && !mapLayerExists) {
			// Add layer to map
			this.addLayerToMap(layerId);
		} else if (!layer.visible && mapLayerExists) {
			// Remove layer from map
			map.removeLayer(layerId);
			if (map.getSource(layerId)) {
				map.removeSource(layerId);
			}
		} else if (layer.visible && mapLayerExists) {
			// Update layer opacity
			map.setPaintProperty(layerId, 'raster-opacity', layer.opacity);
		}
	},

	addLayerToMap(layerId: string) {
		const currentState = this.getCurrentState();
		const map = currentState.map;
		const layer = currentState.layers.get(layerId);
		if (!map || !layer) return;

		// Add source if it doesn't exist
		if (!map.getSource(layerId)) {
			// Handle different tile URL formats
			let tileUrls: string[];

			if (layerId.startsWith('carto-')) {
				// CartoDB layers use direct tile URLs
				tileUrls = [
					layer.url.replace('a.basemaps', 'a.basemaps'),
					layer.url.replace('a.basemaps', 'b.basemaps'),
					layer.url.replace('a.basemaps', 'c.basemaps'),
					layer.url.replace('a.basemaps', 'd.basemaps')
				];
			} else {
				// LIST service layers use tile endpoint
				tileUrls = [`${layer.url}/tile/{z}/{y}/{x}`];
			}

			map.addSource(layerId, {
				type: 'raster',
				tiles: tileUrls,
				tileSize: 256,
				attribution: layerId.startsWith('carto-')
					? '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					: undefined
			});
		}

		// Add layer if it doesn't exist
		if (!map.getLayer(layerId)) {
			// Find the first feature layer to insert basemap layers before it
			// Feature layers have IDs that contain underscores (service_layerId format)
			const mapLayers = map.getStyle().layers;
			const firstFeatureLayerId = mapLayers.find((l) => l.id.includes('_'))?.id;

			map.addLayer(
				{
					id: layerId,
					type: 'raster',
					source: layerId,
					paint: {
						'raster-opacity': layer.opacity
					}
				},
				firstFeatureLayerId
			); // Insert before first feature layer, or at top if none
		}
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

	// State persistence
	saveState() {
		const currentState = this.getCurrentState();
		const persistedState: PersistedMapState = {
			activeLayerIds: Array.from(currentState.activeLayerIds),
			activeDynamicLayerIds: Array.from(currentState.activeDynamicLayerIds),
			dynamicLayerOrder: currentState.dynamicLayerOrder,
			favoriteLayerIds: Array.from(currentState.favoriteLayerIds),
			center: currentState.center,
			zoom: currentState.zoom,
			bearing: currentState.bearing
		};
		saveStateToStorage(persistedState);
	}
};
