/**
 * Configuration for custom external links in layer features
 * Allows adding layer-specific external links based on feature attributes
 */

export interface LayerLink {
	/** Display text for the link */
	label: string;
	/** URL template with {FIELD_NAME} placeholders */
	urlTemplate: string;
	/** Required field that must exist and have a value for the link to show */
	requiredField: string;
	/** Optional description for accessibility */
	description?: string;
	/** Icon to display with the link (optional) */
	icon?: string;
}

export interface LayerLinkConfig {
	/** Layer ID in format "serviceName_layerId" */
	layerId: string;
	/** Array of external links for this layer */
	links: LayerLink[];
}

/**
 * Configuration for layer-specific external links
 */
export const layerLinksConfig: LayerLinkConfig[] = [
	{
		layerId: 'Public/TopographyAndRelief_1', // Survey Control layer
		links: [
			{
				label: 'View in SURCOM',
				urlTemplate:
					'https://surcom.dpipwe.tas.gov.au/surcom/jsp/site/site_cont.jsp?cmd=list&id=0&datum=140&site_packId={PACK_ID}',
				requiredField: 'PACK_ID',
				description: 'View detailed survey control information in SURCOM database',
				icon: 'external-link'
			}
		]
	},
	{
		layerId: 'Public/CadastreParcels_0', // Another layer
		links: [
			{
				label: 'View in Another Service',
				urlTemplate:
					'https://www.thelist.tas.gov.au/app/content/property/property-search?propertySearchCriteria.volume={VOLUME}&propertySearchCriteria.folio={FOLIO}',
				requiredField: 'VOLUME',
				description: 'View detailed information in another service',
				icon: 'external-link'
			}
		]
	}
];

/**
 * Get external links configuration for a specific layer
 */
export function getLayerLinks(layerId: string): LayerLink[] {
	const config = layerLinksConfig.find((c) => c.layerId === layerId);
	return config?.links || [];
}

/**
 * Generate a URL by replacing field placeholders with actual values
 */
export function generateLinkUrl(urlTemplate: string, attributes: Record<string, unknown>): string {
	let url = urlTemplate;

	// Replace all {FIELD_NAME} placeholders with actual field values
	Object.entries(attributes).forEach(([fieldName, value]) => {
		const placeholder = `{${fieldName}}`;
		if (url.includes(placeholder) && value != null) {
			url = url.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), String(value));
		}
	});

	return url;
}

/**
 * Check if a link should be displayed based on required field availability
 */
export function shouldShowLink(link: LayerLink, attributes: Record<string, unknown>): boolean {
	const fieldValue = attributes[link.requiredField];
	return fieldValue != null && fieldValue !== '' && fieldValue !== undefined;
}
