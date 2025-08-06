/**
 * Service for searching features within active map layers using ArcGIS Query API
 */

import type { SearchableLayer } from './listService.js';

export interface SearchResult {
	id: string; // Unique identifier for the result
	layerId: string; // Source layer ID
	layerName: string; // Human-readable layer name
	serviceName: string; // Service name for context
	attributes: Record<string, any>; // Feature attributes
	geometry?: {
		type: 'Point' | 'Polyline' | 'Polygon';
		coordinates: number[] | number[][] | number[][][];
		spatialReference?: {
			wkid: number;
		};
	};
	// Processed display fields
	displayName?: string; // Primary display name for the feature
	displayValue?: string; // Secondary display value
	bbox?: [number, number, number, number]; // Bounding box for zooming
}

export interface SearchOptions {
	text?: string; // Text search term
	where?: string; // SQL where clause
	maxResults?: number; // Maximum results per layer
	returnGeometry?: boolean; // Whether to return geometry
	spatialReference?: number; // Output spatial reference (default: 4326 for MapLibre compatibility)
}

export interface SearchResponse {
	results: SearchResult[];
	hasMore: boolean; // Whether there are more results available
	totalCount: number; // Total number of results across all layers
	errors: Array<{ layerId: string; error: string }>; // Any errors that occurred
}

/**
 * Search features across multiple layers
 */
export async function searchFeatures(
	layers: SearchableLayer[],
	options: SearchOptions
): Promise<SearchResponse> {
	const {
		text = '',
		where,
		maxResults = 10,
		returnGeometry = true,
		spatialReference = 4326 // Use WGS84 for MapLibre compatibility
	} = options;

	if (!text.trim() && !where) {
		return {
			results: [],
			hasMore: false,
			totalCount: 0,
			errors: []
		};
	}

	const searchPromises = layers.map((layer) =>
		searchLayerFeatures(layer, {
			text: text.trim(),
			where,
			maxResults,
			returnGeometry,
			spatialReference
		})
	);

	try {
		const layerResults = await Promise.allSettled(searchPromises);
		const results: SearchResult[] = [];
		const errors: Array<{ layerId: string; error: string }> = [];
		let totalCount = 0;

		layerResults.forEach((result, index) => {
			const layer = layers[index];
			if (result.status === 'fulfilled') {
				results.push(...result.value.results);
				totalCount += result.value.totalCount;
			} else {
				errors.push({
					layerId: layer.id,
					error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
				});
			}
		});

		// Sort results by relevance (exact matches first, then partial matches)
		const searchTerm = text.toLowerCase();
		results.sort((a, b) => {
			const aName = (a.displayName || '').toLowerCase();
			const bName = (b.displayName || '').toLowerCase();

			// Exact matches first
			if (aName === searchTerm && bName !== searchTerm) return -1;
			if (bName === searchTerm && aName !== searchTerm) return 1;

			// Then starts with matches
			if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
			if (bName.startsWith(searchTerm) && !aName.startsWith(searchTerm)) return 1;

			// Finally alphabetical
			return aName.localeCompare(bName);
		});

		return {
			results: results.slice(0, maxResults * layers.length),
			hasMore: totalCount > results.length,
			totalCount,
			errors
		};
	} catch (error) {
		console.error('Error searching features:', error);
		return {
			results: [],
			hasMore: false,
			totalCount: 0,
			errors: [{ layerId: 'general', error: 'Search failed' }]
		};
	}
}

/**
 * Search features in a single layer
 */
async function searchLayerFeatures(
	layer: SearchableLayer,
	options: SearchOptions
): Promise<{ results: SearchResult[]; totalCount: number }> {
	const { text, where, maxResults = 10, returnGeometry = true, spatialReference = 4326 } = options;

	// Build query parameters
	const params = new URLSearchParams({
		f: 'pjson',
		outFields: '*', // Get all fields
		returnGeometry: returnGeometry.toString(),
		spatialRel: 'esriSpatialRelIntersects',
		outSR: spatialReference.toString(),
		resultRecordCount: maxResults.toString()
	});

	// Add search criteria
	if (text) {
		params.append('text', text);
	}
	if (where) {
		params.append('where', where);
	}

	const queryUrl = `${layer.serviceUrl}/${layer.layerId}/query?${params.toString()}`;

	try {
		const response = await fetch(queryUrl);
		if (!response.ok) {
			if (response.status === 400) {
				throw new Error(`Invalid query for layer "${layer.name}"`);
			} else if (response.status === 403) {
				throw new Error(`Access denied to layer "${layer.name}"`);
			} else if (response.status === 404) {
				throw new Error(`Layer "${layer.name}" not found`);
			} else if (response.status >= 500) {
				throw new Error(`Server error when querying "${layer.name}"`);
			}
			throw new Error(`Query failed for "${layer.name}": ${response.statusText}`);
		}

		const data = await response.json();

		if (data.error) {
			const errorMsg = data.error.message || data.error.details?.[0] || 'Query error';
			throw new Error(`${layer.name}: ${errorMsg}`);
		}

		// Check if the layer supports text search
		if (!data.features && data.exceededTransferLimit === false) {
			throw new Error(`Layer "${layer.name}" may not support text search`);
		}

		const features = data.features || [];
		const results: SearchResult[] = features.map((feature: any, index: number) =>
			processFeatureResult(feature, layer, index)
		);

		return {
			results,
			totalCount: features.length
		};
	} catch (error) {
		console.warn(`Failed to search layer ${layer.name}:`, error);

		// Re-throw with more specific error messages
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(`Network error when searching "${layer.name}"`);
		}

		throw error;
	}
}

/**
 * Process a raw ArcGIS feature into a SearchResult
 */
export function processFeatureResult(
	feature: any,
	layer: SearchableLayer,
	index: number
): SearchResult {
	const attributes = feature.attributes || {};
	const geometry = feature.geometry;

	// Try to find a good display name from common field names
	const displayName = findDisplayName(attributes);
	const displayValue = findDisplayValue(attributes, displayName);

	// Process geometry if available
	let processedGeometry;
	let bbox;

	if (geometry) {
		processedGeometry = processGeometry(geometry);
		bbox = calculateBoundingBox(geometry);
	}

	return {
		id: `${layer.id}_${attributes.OBJECTID || attributes.FID || attributes.ID || index}`,
		layerId: layer.id,
		layerName: layer.name,
		serviceName: layer.serviceName.replace('Public/', ''),
		attributes,
		geometry: processedGeometry,
		displayName,
		displayValue,
		bbox
	};
}

/**
 * Find the best field to use as display name
 */
function findDisplayName(attributes: Record<string, any>): string {
	// Common field names that make good display names
	const nameFields = [
		'NAME',
		'Name',
		'name',
		'LABEL',
		'Label',
		'label',
		'TITLE',
		'Title',
		'title',
		'ID',
		'Id',
		'id',
		'CODE',
		'Code',
		'code',
		'PACK_ID',
		'PackId',
		'pack_id'
	];

	for (const field of nameFields) {
		if (attributes[field] && typeof attributes[field] === 'string') {
			return attributes[field];
		}
	}

	// Fallback to first string field
	for (const [key, value] of Object.entries(attributes)) {
		if (typeof value === 'string' && value.trim()) {
			return value;
		}
	}

	return 'Feature';
}

/**
 * Find a secondary display value
 */
function findDisplayValue(
	attributes: Record<string, any>,
	displayName?: string
): string | undefined {
	// Common secondary fields
	const valueFields = [
		'DESCRIPTION',
		'Description',
		'description',
		'TYPE',
		'Type',
		'type',
		'CATEGORY',
		'Category',
		'category',
		'STATUS',
		'Status',
		'status'
	];

	for (const field of valueFields) {
		if (
			attributes[field] &&
			typeof attributes[field] === 'string' &&
			attributes[field] !== displayName
		) {
			return attributes[field];
		}
	}

	return undefined;
}

/**
 * Process geometry from ArcGIS format to GeoJSON-like format
 */
function processGeometry(geometry: any): SearchResult['geometry'] {
	if (!geometry) return undefined;

	if (geometry.x !== undefined && geometry.y !== undefined) {
		// Point geometry - ArcGIS returns x,y
		let coordinates = [geometry.x, geometry.y];

		// Check if coordinates might be in Web Mercator (large numbers) and need transformation
		if (Math.abs(geometry.x) > 180 || Math.abs(geometry.y) > 90) {
			// Transform from Web Mercator to WGS84
			// This is a simplified transformation - proper transformation would use proj4js
			const lng = (geometry.x / 20037508.34) * 180;
			const lat = (Math.atan(Math.exp((geometry.y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
			coordinates = [lng, lat];
		}

		return {
			type: 'Point',
			coordinates: coordinates,
			spatialReference: geometry.spatialReference
		};
	}

	if (geometry.paths) {
		// Polyline geometry
		return {
			type: 'Polyline',
			coordinates: geometry.paths,
			spatialReference: geometry.spatialReference
		};
	}

	if (geometry.rings) {
		// Polygon geometry
		return {
			type: 'Polygon',
			coordinates: geometry.rings,
			spatialReference: geometry.spatialReference
		};
	}

	return undefined;
}

/**
 * Calculate bounding box for geometry
 */
function calculateBoundingBox(geometry: any): [number, number, number, number] | undefined {
	if (!geometry) return undefined;

	if (geometry.x !== undefined && geometry.y !== undefined) {
		let x = geometry.x;
		let y = geometry.y;

		// Check if coordinates need transformation from Web Mercator to WGS84
		if (Math.abs(x) > 180 || Math.abs(y) > 90) {
			// Convert from Web Mercator to WGS84
			x = (x / 20037508.34) * 180;
			y = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
		}

		// Point - create small bbox around point in degrees
		const buffer = 0.001; // approximately 100 meters in degrees at Tasmania's latitude
		return [x - buffer, y - buffer, x + buffer, y + buffer];
	}

	if (geometry.paths) {
		// Polyline
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		geometry.paths.forEach((path: number[][]) => {
			path.forEach(([x, y]) => {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			});
		});
		return [minX, minY, maxX, maxY];
	}

	if (geometry.rings) {
		// Polygon
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		geometry.rings.forEach((ring: number[][]) => {
			ring.forEach(([x, y]) => {
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			});
		});
		return [minX, minY, maxX, maxY];
	}

	return undefined;
}

/**
 * Debounced search function for real-time search
 */
export function createDebouncedSearch(
	callback: (query: string) => void,
	delay: number = 300
): (query: string) => void {
	let timeoutId: ReturnType<typeof setTimeout>;

	return (query: string) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => callback(query), delay);
	};
}
