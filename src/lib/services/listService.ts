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
}

const LIST_BASE_URL = 'https://services.thelist.tas.gov.au/arcgis/rest/services';
const PUBLIC_SERVICES_URL = `${LIST_BASE_URL}/Public?f=pjson`;

// Cache for loaded services to avoid repeated requests
const servicesCache = new Map<string, ArcGISMapServer>();
let allLayersCache: SearchableLayer[] | null = null;
let servicesListCache: string[] | null = null;

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
		servicesListCache = data.services
			.filter((service: any) => service.type === 'MapServer')
			.map((service: any) => service.name);

		return servicesListCache!;
	} catch (error) {
		console.error('Error fetching public services:', error);
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
		const serviceUrl = `${LIST_BASE_URL}/${serviceName}/MapServer`;
		const response = await fetch(`${serviceUrl}?f=pjson`);

		if (!response.ok) {
			throw new Error(`Failed to fetch service ${serviceName}: ${response.statusText}`);
		}

		const data = await response.json();

		if (!data.layers || !Array.isArray(data.layers)) {
			throw new Error(`Invalid service response for ${serviceName}`);
		}

		const mapServer: ArcGISMapServer = {
			serviceName,
			serviceUrl,
			name: data.mapName || serviceName,
			description: data.description || data.serviceDescription,
			layers: data.layers.map((layer: any) => ({
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
			})),
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
 * Load all available layers from all public services
 */
export async function loadAllLayers(): Promise<SearchableLayer[]> {
	if (allLayersCache) {
		return allLayersCache;
	}

	try {
		const serviceNames = await fetchPublicServices();
		const allLayers: SearchableLayer[] = [];

		// Load services in batches to avoid overwhelming the server
		const batchSize = 5;
		for (let i = 0; i < serviceNames.length; i += batchSize) {
			const batch = serviceNames.slice(i, i + batchSize);
			const batchPromises = batch.map(async (serviceName) => {
				try {
					const mapServer = await fetchMapService(serviceName);
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
 * Clear all caches (useful for development or forced refresh)
 */
export function clearCache(): void {
	servicesCache.clear();
	allLayersCache = null;
	servicesListCache = null;
}
