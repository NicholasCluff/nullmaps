/**
 * Service for querying features at specific map locations (click-to-identify)
 * Uses ArcGIS Query API with geometry parameter for spatial queries
 */

import type { SearchableLayer, LayerField } from './listService.js';
import { fetchLayerFields } from './listService.js';
import type { SearchResult } from './searchService.js';
import { processFeatureResult } from './searchService.js';
import {
	getLayerLinks,
	generateLinkUrl,
	shouldShowLink,
	type LayerLink
} from './layerLinksConfig.js';

export interface ClickQueryOptions {
	geometry: {
		x: number; // Longitude in WGS84
		y: number; // Latitude in WGS84
	};
	tolerance?: number; // Search tolerance in pixels (default: 5)
	maxResults?: number; // Maximum results per layer (default: 5)
	returnGeometry?: boolean; // Whether to return feature geometry (default: true)
	searchText?: string; // Optional text to search across all fields (case-insensitive)
}

export interface ClickQueryResult extends SearchResult {
	distance?: number; // Distance from click point (if calculated)
}

export interface ClickQueryResponse {
	results: ClickQueryResult[];
	clickLocation: { x: number; y: number };
	queriedLayers: number; // Number of layers queried
	errors: Array<{ layerId: string; error: string }>;
}

/**
 * Query features at a specific map location across multiple active layers
 */
export async function queryFeaturesAtLocation(
	layers: SearchableLayer[],
	options: ClickQueryOptions
): Promise<ClickQueryResponse> {
	const { geometry, tolerance = 5, maxResults = 5, returnGeometry = true } = options;

	if (!layers || layers.length === 0) {
		return {
			results: [],
			clickLocation: geometry,
			queriedLayers: 0,
			errors: []
		};
	}

	// Query each active layer concurrently
	const queryPromises = layers.map((layer) =>
		queryLayerAtLocation(layer, {
			geometry,
			tolerance,
			maxResults,
			returnGeometry
		})
	);

	try {
		const layerResults = await Promise.allSettled(queryPromises);
		const results: ClickQueryResult[] = [];
		const errors: Array<{ layerId: string; error: string }> = [];

		layerResults.forEach((result, index) => {
			const layer = layers[index];
			if (result.status === 'fulfilled') {
				// Add layer-specific results with distance calculation
				const layerFeatures = result.value.map((feature) => ({
					...feature,
					distance: calculateDistance(geometry, feature.geometry)
				}));
				results.push(...layerFeatures);
			} else {
				errors.push({
					layerId: layer.id,
					error: result.reason instanceof Error ? result.reason.message : 'Query failed'
				});
			}
		});

		// Sort results by distance from click point (closest first)
		results.sort((a, b) => {
			if (a.distance !== undefined && b.distance !== undefined) {
				return a.distance - b.distance;
			}
			// If no distance, sort by layer name then display name
			if (a.layerName !== b.layerName) {
				return a.layerName.localeCompare(b.layerName);
			}
			return (a.displayName || '').localeCompare(b.displayName || '');
		});

		return {
			results: results.slice(0, maxResults * layers.length),
			clickLocation: geometry,
			queriedLayers: layers.length,
			errors
		};
	} catch (error) {
		console.error('Error querying features at location:', error);
		return {
			results: [],
			clickLocation: geometry,
			queriedLayers: layers.length,
			errors: [{ layerId: 'general', error: 'Click query failed' }]
		};
	}
}

/**
 * Query a single layer at a specific location
 */
async function queryLayerAtLocation(
	layer: SearchableLayer,
	options: ClickQueryOptions
): Promise<ClickQueryResult[]> {
	const { geometry, maxResults = 5, returnGeometry = true, searchText } = options;

	// LIST services expect a simple bounding box geometry format: "minX,minY,maxX,maxY"
	// Create a bounding box around the click point using WGS84 coordinates (not Web Mercator)
	const buffer = 0.0001; // Very small buffer in degrees (approximately 10m at Tasmania's latitude)
	const minX = geometry.x - buffer;
	const minY = geometry.y - buffer;
	const maxX = geometry.x + buffer;
	const maxY = geometry.y + buffer;

	const geometryParam = `${minX},${minY},${maxX},${maxY}`;

	// Get field information for case-insensitive querying
	let fields: LayerField[] = [];
	try {
		fields = layer.fields || (await fetchLayerFields(layer));
	} catch (error) {
		console.warn(`Could not fetch fields for ${layer.name}, using basic query:`, error);
	}

	// Build field list for outFields - use all available fields
	const outFields = fields.length > 0 ? fields.map((f) => f.name).join(',') : '*';

	// Build WHERE clause for case-insensitive field searching
	const whereClause = buildCaseInsensitiveWhereClause(fields, searchText);

	// Build query parameters for spatial query
	const params = new URLSearchParams({
		f: 'pjson',
		geometry: geometryParam,
		geometryType: 'esriGeometryEnvelope', // Use envelope (bounding box) instead of point
		spatialRel: 'esriSpatialRelIntersects',
		inSR: '4326', // Input geometry is in WGS84 coordinates
		outFields, // Use specific fields or all fields
		returnGeometry: returnGeometry.toString(),
		outSR: '4326', // Return results in WGS84 for MapLibre compatibility
		resultRecordCount: maxResults.toString(),
		where: whereClause // Use field-based filtering for better results
	});

	const queryUrl = `${layer.serviceUrl}/${layer.layerId}/query?${params.toString()}`;

	// Debug: Log the full query URL and parameters
	console.log(`🔍 Click Query Debug for "${layer.name}":`, {
		layerId: layer.id,
		serviceName: layer.serviceName,
		layerName: layer.name,
		serviceUrl: layer.serviceUrl,
		queryUrl: queryUrl,
		geometryParam: geometryParam,
		clickLocation: `${geometry.x}, ${geometry.y}`,
		boundingBox: `${minX},${minY} to ${maxX},${maxY}`,
		whereClause: whereClause,
		searchText: searchText || 'none',
		fieldsCount: fields.length,
		outFields: outFields === '*' ? 'all fields' : `${fields.length} specific fields`
	});

	try {
		const response = await fetch(queryUrl);

		if (!response.ok) {
			console.error(`❌ Query failed for "${layer.name}" (HTTP ${response.status}):`, queryUrl);
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		// Debug: Log the response
		console.log(`✅ Query response for "${layer.name}":`, {
			featuresFound: data.features?.length || 0,
			hasError: !!data.error,
			error: data.error
		});

		if (data.error) {
			// Enhanced error reporting for debugging
			console.error(`🚨 Detailed error for "${layer.name}":`, {
				error: data.error,
				queryUrl: queryUrl,
				layer: {
					id: layer.id,
					name: layer.name,
					serviceUrl: layer.serviceUrl,
					layerId: layer.layerId
				}
			});

			const errorMsg =
				data.error.message ||
				data.error.details?.[0] ||
				`Query error (HTTP ${data.error.code || 'unknown'})`;

			// Some layers may not support spatial queries - make this clearer
			if (data.error.code === 400) {
				throw new Error(
					`${layer.name}: Layer may not support spatial queries or invalid parameters`
				);
			}

			throw new Error(`${layer.name}: ${errorMsg}`);
		}

		const features = data.features || [];

		// Process each feature using the existing search service logic
		const results: ClickQueryResult[] = features.map((feature: unknown, index: number) => {
			// Use the existing feature processing function from searchService
			const searchResult = processFeatureResult(feature, layer, index);
			return {
				...searchResult
				// Distance will be calculated later in the main function
			} as ClickQueryResult;
		});

		return results;
	} catch (error) {
		console.warn(`Failed to query layer ${layer.name} at location:`, error);

		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new Error(`Network error when querying "${layer.name}"`);
		}

		throw error;
	}
}

/**
 * Build case-insensitive WHERE clause for text field queries
 * This helps find features that match query terms in any field
 */
function buildCaseInsensitiveWhereClause(fields: LayerField[], searchTerm?: string): string {
	if (!searchTerm || !fields.length) {
		return '1=1'; // Return all features if no search term
	}

	// Filter to text-based fields that can be searched
	const searchableFields = fields.filter(
		(field) =>
			field.type === 'esriFieldTypeString' ||
			field.type === 'esriFieldTypeOID' ||
			field.type === 'esriFieldTypeInteger' ||
			field.type === 'esriFieldTypeSmallInteger' ||
			field.type === 'esriFieldTypeDouble' ||
			field.type === 'esriFieldTypeSingle'
	);

	if (searchableFields.length === 0) {
		return '1=1';
	}

	// Create case-insensitive LIKE clauses for each searchable field
	const fieldClauses = searchableFields
		.map((field) => {
			// For string fields, use UPPER() for case-insensitive search
			if (field.type === 'esriFieldTypeString') {
				return `UPPER(${field.name}) LIKE UPPER('%${searchTerm.replace(/'/g, "''")}%')`;
			} else {
				// For numeric fields, try exact match if the search term is numeric
				const numericValue = parseFloat(searchTerm);
				if (!isNaN(numericValue)) {
					return `${field.name} = ${numericValue}`;
				}
				return null;
			}
		})
		.filter((clause) => clause !== null);

	if (fieldClauses.length === 0) {
		return '1=1';
	}

	// Combine all field clauses with OR
	return `(${fieldClauses.join(' OR ')})`;
}

/**
 * Calculate distance between click point and feature geometry
 * Returns distance in degrees (approximate)
 */
function calculateDistance(
	clickPoint: { x: number; y: number },
	featureGeometry?: ClickQueryResult['geometry']
): number | undefined {
	if (!featureGeometry) return undefined;

	if (featureGeometry.type === 'Point') {
		const [lng, lat] = featureGeometry.coordinates as [number, number];

		// Simple Euclidean distance in degrees (good enough for short distances)
		const dx = clickPoint.x - lng;
		const dy = clickPoint.y - lat;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// For polylines and polygons, we'd need more complex calculation
	// For now, return undefined for non-point geometries
	return undefined;
}

/**
 * Enhanced click query that searches all fields case-insensitively
 * Useful for implementing "identify" functionality with optional text filtering
 */
export async function queryFeaturesWithTextSearch(
	layers: SearchableLayer[],
	location: { x: number; y: number },
	searchText?: string,
	options?: Partial<ClickQueryOptions>
): Promise<ClickQueryResponse> {
	return queryFeaturesAtLocation(layers, {
		geometry: location,
		tolerance: options?.tolerance || 5,
		maxResults: options?.maxResults || 10,
		returnGeometry: options?.returnGeometry ?? true,
		searchText
	});
}

export interface FormattedFeature {
	title: string;
	subtitle?: string;
	attributes: Array<{ key: string; value: string }>;
	externalLinks: Array<{
		label: string;
		url: string;
		description?: string;
		icon?: string;
	}>;
}

export interface FormattedLayerGroup {
	layerName: string;
	features: FormattedFeature[];
}

export interface FormattedClickResults {
	title: string;
	subtitle: string;
	summary: string;
	layerGroups: FormattedLayerGroup[];
}

/**
 * Format click query results for mobile display
 */
export function formatClickResults(results: ClickQueryResult[]): FormattedClickResults {
	if (results.length === 0) {
		return {
			title: 'No Features Found',
			subtitle: 'No features found at this location',
			summary: 'Try clicking on a visible map feature',
			layerGroups: []
		};
	}

	// Group results by layer
	const layerMap = new Map<string, ClickQueryResult[]>();
	results.forEach((result) => {
		if (!layerMap.has(result.layerName)) {
			layerMap.set(result.layerName, []);
		}
		layerMap.get(result.layerName)!.push(result);
	});

	const layerGroups = Array.from(layerMap.entries()).map(([layerName, features]) => ({
		layerName,
		features: features.map((feature) => {
			// Get external links for this layer
			const layerLinks = getLayerLinks(feature.layerId);
			const externalLinks = layerLinks
				.filter((link) => shouldShowLink(link, feature.attributes))
				.map((link) => ({
					label: link.label,
					url: generateLinkUrl(link.urlTemplate, feature.attributes),
					description: link.description,
					icon: link.icon
				}));

			return {
				title: feature.displayName || 'Feature',
				subtitle: feature.displayValue,
				attributes: formatAttributes(feature.attributes),
				externalLinks
			};
		})
	}));

	const totalFeatures = results.length;
	const totalLayers = layerGroups.length;

	return {
		title: totalFeatures === 1 ? '1 Feature Found' : `${totalFeatures} Features Found`,
		subtitle: totalLayers === 1 ? `From ${layerGroups[0].layerName}` : `From ${totalLayers} layers`,
		summary:
			totalFeatures === 1 ? results[0].displayName || 'Feature' : `${totalFeatures} features found`,
		layerGroups
	};
}

/**
 * Format feature attributes for display, filtering out technical fields
 */
function formatAttributes(
	attributes: Record<string, unknown>
): Array<{ key: string; value: string }> {
	const excludeFields = new Set([
		'OBJECTID',
		'FID',
		'SHAPE',
		'Shape',
		'SHAPE_Length',
		'SHAPE_Area',
		'GlobalID',
		'created_user',
		'created_date',
		'last_edited_user',
		'last_edited_date'
	]);

	return Object.entries(attributes)
		.filter(([key, value]) => {
			// Exclude technical fields and null/empty values
			return (
				!excludeFields.has(key) &&
				value !== null &&
				value !== undefined &&
				value !== '' &&
				typeof value !== 'object'
			); // Exclude complex objects
		})
		.map(([key, value]) => ({
			key: formatFieldName(key),
			value: String(value)
		})); // Show all relevant attributes
}

/**
 * Format field names for display (convert UPPER_CASE to Title Case)
 */
function formatFieldName(fieldName: string): string {
	return fieldName
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}
