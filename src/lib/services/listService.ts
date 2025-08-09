/**
 * Service for fetching and managing Tasmania LIST (Land Information System Tasmania) services
 * Dynamically loads all available public map servers and their layers
 */

export interface ArcGISLayer {
	id: number;
	name: string;
	type: string;
	description?: string;
	geometryType?: string;
	minScale?: number;
	maxScale?: number;
	defaultVisibility: boolean;
	parentLayerId?: number;
	subLayerIds?: number[];
}

export interface ArcGISMapServer {
	serviceName: string;
	serviceUrl: string;
	name: string;
	description?: string;
	layers: ArcGISLayer[];
	spatialReference?: {
		wkid: number;
		latestWkid?: number;
	};
	initialExtent?: {
		xmin: number;
		ymin: number;
		xmax: number;
		ymax: number;
	};
}

export interface LayerField {
	name: string;
	type: string;
	alias?: string;
	length?: number;
}

export interface SearchableLayer {
	id: string; // Unique ID combining service and layer
	layerId: number; // Original layer ID from ArcGIS
	name: string;
	description?: string;
	serviceName: string;
	serviceUrl: string;
	type: string;
	geometryType?: string;
	defaultVisibility: boolean;
	minScale?: number;
	maxScale?: number;
	fields?: LayerField[]; // Cached field information for query optimization
	searchableFields?: Set<string>; // User-selected field names for searching
}

const LIST_BASE_URL = 'https://services.thelist.tas.gov.au/arcgis/rest/services';
const PUBLIC_SERVICES_URL = `${LIST_BASE_URL}/Public?f=pjson`;
const BASEMAPS_SERVICES_URL = `${LIST_BASE_URL}/Basemaps?f=pjson`;

// Cache for loaded services to avoid repeated requests
const servicesCache = new Map<string, ArcGISMapServer>();
let allLayersCache: SearchableLayer[] | null = null;
let servicesListCache: string[] | null = null;
// Cache for layer fields to avoid repeated field requests
const layerFieldsCache = new Map<string, LayerField[]>();

/**
 * Fetch the list of all public map services
 */
export async function fetchPublicServices(): Promise<string[]> {
	if (servicesListCache) {
		return servicesListCache;
	}

	try {
		const response = await fetch(PUBLIC_SERVICES_URL);
		if (!response.ok) {
			throw new Error(`Failed to fetch services: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.services || !Array.isArray(data.services)) {
			throw new Error('Invalid services response format');
		}

		// Extract service names and filter for MapServer type
		// For Public services, we keep just the service name (no prefix) for backward compatibility
		servicesListCache = data.services
			.filter((service: { type: string; name: string }) => service.type === 'MapServer')
			.map((service: { type: string; name: string }) => service.name);

		return servicesListCache!;
	} catch (error) {
		console.error('Error fetching public services:', error);
		throw error;
	}
}

/**
 * Fetch the list of all basemap services
 */
export async function fetchBasemapServices(): Promise<string[]> {
	try {
		const response = await fetch(BASEMAPS_SERVICES_URL);
		if (!response.ok) {
			throw new Error(`Failed to fetch basemap services: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.services || !Array.isArray(data.services)) {
			throw new Error('Invalid basemap services response format');
		}

		// Extract service names and filter for MapServer type
		// Service names already include "Basemaps/" prefix, so don't add it again
		const basemapServices = data.services
			.filter((service: { type: string; name: string }) => service.type === 'MapServer')
			.map((service: { type: string; name: string }) => service.name);

		return basemapServices;
	} catch (error) {
		console.error('Error fetching basemap services:', error);
		throw error;
	}
}

/**
 * Fetch detailed information for a specific map service
 */
export async function fetchMapService(serviceName: string): Promise<ArcGISMapServer> {
	if (servicesCache.has(serviceName)) {
		return servicesCache.get(serviceName)!;
	}

	try {
		// Handle both Public and Basemaps service paths
		// serviceName could be 'Public/ServiceName' or 'Basemaps/ServiceName' or just 'ServiceName' (for Public)
		const serviceUrl = serviceName.includes('/')
			? `${LIST_BASE_URL}/${serviceName}/MapServer`
			: `${LIST_BASE_URL}/Public/${serviceName}/MapServer`;

		const response = await fetch(`${serviceUrl}?f=pjson`);

		if (!response.ok) {
			throw new Error(`Failed to fetch service ${serviceName}: ${response.statusText}`);
		}

		const data = await response.json();

		// Basemap services might not have layers array, or have an empty one
		// For basemaps, we'll create a virtual layer representing the entire service
		if (!data.layers || !Array.isArray(data.layers) || data.layers.length === 0) {
			if (serviceName.startsWith('Basemaps/')) {
				data.layers = [
					{
						id: 0,
						name: data.mapName || serviceName.split('/')[1],
						type: 'Raster Layer',
						description: data.description || data.serviceDescription,
						defaultVisibility: false
					}
				];
			} else {
				throw new Error(`Invalid service response for ${serviceName}`);
			}
		}

		const mapServer: ArcGISMapServer = {
			serviceName,
			serviceUrl,
			name: data.mapName || serviceName,
			description: data.description || data.serviceDescription,
			layers: data.layers.map(
				(layer: {
					id: number;
					name: string;
					type?: string;
					description?: string;
					geometryType?: string;
					minScale?: number;
					maxScale?: number;
					defaultVisibility?: boolean;
					parentLayerId?: number;
					subLayerIds?: number[];
				}) => ({
					id: layer.id,
					name: layer.name,
					type: layer.type || 'Feature Layer',
					description: layer.description,
					geometryType: layer.geometryType,
					minScale: layer.minScale || 0,
					maxScale: layer.maxScale || 0,
					defaultVisibility: layer.defaultVisibility || false,
					parentLayerId: layer.parentLayerId,
					subLayerIds: layer.subLayerIds
				})
			),
			spatialReference: data.spatialReference,
			initialExtent: data.initialExtent
		};

		servicesCache.set(serviceName, mapServer);
		return mapServer;
	} catch (error) {
		console.error(`Error fetching map service ${serviceName}:`, error);
		throw error;
	}
}

/**
 * Load all available layers from all public and basemap services
 */
export async function loadAllLayers(): Promise<SearchableLayer[]> {
	if (allLayersCache) {
		return allLayersCache;
	}

	try {
		// Fetch both public and basemap services
		const [publicServices, basemapServices] = await Promise.all([
			fetchPublicServices(),
			fetchBasemapServices()
		]);
		const serviceNames = [...publicServices, ...basemapServices];
		const allLayers: SearchableLayer[] = [];

		// Load services in batches to avoid overwhelming the server
		const batchSize = 5;
		for (let i = 0; i < serviceNames.length; i += batchSize) {
			const batch = serviceNames.slice(i, i + batchSize);
			const batchPromises = batch.map(async (serviceName) => {
				try {
					const mapServer = await fetchMapService(serviceName);

					// Handle basemap services differently - they're meant to be used as single map layers
					if (serviceName.startsWith('Basemaps/')) {
						// For basemaps, create a single layer representing the entire service
						const basemapLayer = {
							id: serviceName.replace('/', '_'), // Convert Basemaps/ServiceName to Basemaps_ServiceName
							layerId: 0, // Basemaps typically use layer 0 or the entire service
							name: mapServer.name || serviceName.split('/')[1], // Use map name or service name
							description: mapServer.description || `Tasmania ${serviceName.split('/')[1]} basemap`,
							serviceName: mapServer.serviceName,
							serviceUrl: mapServer.serviceUrl,
							type: 'Basemap Layer',
							geometryType: undefined, // Basemaps don't have geometry types
							defaultVisibility: false, // Don't show basemaps by default as overlays
							minScale: 0,
							maxScale: 0
						};
						return [basemapLayer];
					} else {
						// Handle regular Public services with multiple layers
						return mapServer.layers.map(
							(layer): SearchableLayer => ({
								id: `${serviceName}_${layer.id}`,
								layerId: layer.id,
								name: layer.name,
								description: layer.description,
								serviceName: mapServer.serviceName,
								serviceUrl: mapServer.serviceUrl,
								type: layer.type,
								geometryType: layer.geometryType,
								defaultVisibility: layer.defaultVisibility,
								minScale: layer.minScale,
								maxScale: layer.maxScale
							})
						);
					}
				} catch (error) {
					console.warn(`Failed to load service ${serviceName}:`, error);
					return [];
				}
			});

			const batchResults = await Promise.all(batchPromises);
			allLayers.push(...batchResults.flat());

			// Small delay between batches to be respectful to the server
			if (i + batchSize < serviceNames.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		allLayersCache = allLayers;
		return allLayers;
	} catch (error) {
		console.error('Error loading all layers:', error);
		throw error;
	}
}

/**
 * Search layers by name or description
 */
export function searchLayers(layers: SearchableLayer[], query: string): SearchableLayer[] {
	if (!query.trim()) {
		return layers;
	}

	const searchTerm = query.toLowerCase().trim();

	return layers.filter((layer) => {
		const nameMatch = layer.name.toLowerCase().includes(searchTerm);
		const descriptionMatch = layer.description?.toLowerCase().includes(searchTerm) || false;
		const serviceMatch = layer.serviceName.toLowerCase().includes(searchTerm);

		return nameMatch || descriptionMatch || serviceMatch;
	});
}

/**
 * Group layers by service for organized display
 */
export function groupLayersByService(layers: SearchableLayer[]): Map<string, SearchableLayer[]> {
	const grouped = new Map<string, SearchableLayer[]>();

	layers.forEach((layer) => {
		const serviceName = layer.serviceName;
		if (!grouped.has(serviceName)) {
			grouped.set(serviceName, []);
		}
		grouped.get(serviceName)!.push(layer);
	});

	return grouped;
}

/**
 * Get the tile URL for a specific layer
 */
export function getLayerTileUrl(layer: SearchableLayer): string {
	return `${layer.serviceUrl}/${layer.layerId}/tile/{z}/{y}/{x}`;
}

/**
 * Get the feature query URL for a specific layer
 */
export function getLayerQueryUrl(layer: SearchableLayer): string {
	return `${layer.serviceUrl}/${layer.layerId}/query`;
}

/**
 * Fetch field information for a specific layer
 */
export async function fetchLayerFields(layer: SearchableLayer): Promise<LayerField[]> {
	const cacheKey = layer.id;

	if (layerFieldsCache.has(cacheKey)) {
		return layerFieldsCache.get(cacheKey)!;
	}

	try {
		const fieldUrl = `${layer.serviceUrl}/${layer.layerId}?f=pjson`;
		const response = await fetch(fieldUrl);

		if (!response.ok) {
			throw new Error(`Failed to fetch fields for layer ${layer.name}: ${response.statusText}`);
		}

		const data = await response.json();

		if (data.error) {
			throw new Error(`ArcGIS error: ${data.error.message || 'Unknown error'}`);
		}

		const fields: LayerField[] = (data.fields || []).map((field: unknown) => {
			const f = field as Record<string, unknown>;
			return {
				name: String(f.name || ''),
				type: String(f.type || ''),
				alias: f.alias ? String(f.alias) : undefined,
				length: typeof f.length === 'number' ? f.length : undefined
			};
		});

		layerFieldsCache.set(cacheKey, fields);
		return fields;
	} catch (error) {
		console.error(`Error fetching fields for layer ${layer.name}:`, error);
		throw error;
	}
}

/**
 * Clear all caches (useful for development or forced refresh)
 */
export function clearCache(): void {
	servicesCache.clear();
	allLayersCache = null;
	servicesListCache = null;
	layerFieldsCache.clear();
}
