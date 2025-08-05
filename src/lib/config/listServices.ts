/**
 * Tasmania LIST (Land Information System Tasmania) services configuration
 * Base URL: https://services.thelist.tas.gov.au/arcgis/rest/services
 */

export const LIST_BASE_URL = 'https://services.thelist.tas.gov.au/arcgis/rest/services';

export interface LayerConfig {
	id: string;
	name: string;
	url: string;
	type: 'raster' | 'vector';
	visible: boolean;
	opacity: number;
	minZoom?: number;
	maxZoom?: number;
}

export interface ServiceGroup {
	id: string;
	name: string;
	description: string;
	layers: LayerConfig[];
}

// Tasmania extent for map initialization
export const TASMANIA_BOUNDS = {
	center: [146.8, -42.0] as [number, number], // Slightly adjusted center
	zoom: 6.5, // Reduced zoom to show more context within expanded bounds
	bounds: [
		[140.0, -46.0], // Southwest - expanded to include more ocean and Bass Strait
		[152.0, -38.0] // Northeast - expanded to include more of Victoria and ocean
	] as [[number, number], [number, number]]
};

// Base map services
export const BASEMAP_SERVICES: ServiceGroup = {
	id: 'basemaps',
	name: 'Base Maps',
	description: 'Background map layers with global coverage',
	layers: [
		{
			id: 'carto-light',
			name: 'CartoDB Light',
			url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
			type: 'raster',
			visible: true,
			opacity: 1.0
		},
		{
			id: 'carto-dark',
			name: 'CartoDB Dark',
			url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
			type: 'raster',
			visible: false,
			opacity: 1.0
		},
		{
			id: 'carto-voyager',
			name: 'CartoDB Voyager',
			url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
			type: 'raster',
			visible: false,
			opacity: 1.0
		},
		{
			id: 'carto-positron',
			name: 'CartoDB Positron',
			url: 'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
			type: 'raster',
			visible: false,
			opacity: 1.0
		}
	]
};

// All service groups (only basemaps - LIST layers are handled dynamically)
export const SERVICE_GROUPS: ServiceGroup[] = [
	BASEMAP_SERVICES
];

// Helper functions
export function getLayerById(layerId: string): LayerConfig | undefined {
	for (const group of SERVICE_GROUPS) {
		const layer = group.layers.find((l) => l.id === layerId);
		if (layer) return layer;
	}
	return undefined;
}

export function getServiceGroupById(groupId: string): ServiceGroup | undefined {
	return SERVICE_GROUPS.find((group) => group.id === groupId);
}

// Default map style configuration
export const DEFAULT_MAP_STYLE = {
	version: 8,
	name: 'NullMaps Tasmania',
	sources: {},
	layers: []
};
