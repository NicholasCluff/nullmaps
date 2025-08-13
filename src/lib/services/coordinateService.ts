/**
 * Coordinate conversion service for transforming MGA coordinates to lat/long
 * Specifically handles MGA Zone 55 (Tasmania) to WGS84/GDA2020 conversions
 * Uses proj4js for reliable browser-based coordinate transformations
 */

import { browser } from '$app/environment';
import proj4 from 'proj4';

export interface MGACoordinate {
	easting: number;
	northing: number;
}

export interface LatLongCoordinate {
	latitude: number;
	longitude: number;
}

export interface CoordinateValidationResult {
	isValid: boolean;
	error?: string;
}

// MGA Zone 55 typical coordinate ranges for Tasmania
const TASMANIA_MGA_BOUNDS = {
	easting: {
		min: 200000, // Western edge
		max: 700000 // Eastern edge
	},
	northing: {
		min: 5150000, // Southern edge
		max: 5700000 // Northern edge
	}
};

/**
 * Validate MGA Zone 55 coordinates for Tasmania
 */
export function validateMGACoordinates(
	easting: number,
	northing: number
): CoordinateValidationResult {
	// Check if inputs are valid numbers
	if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
		return {
			isValid: false,
			error: 'Coordinates must be valid numbers'
		};
	}

	// Check easting range
	if (easting < TASMANIA_MGA_BOUNDS.easting.min || easting > TASMANIA_MGA_BOUNDS.easting.max) {
		return {
			isValid: false,
			error: `Easting must be between ${TASMANIA_MGA_BOUNDS.easting.min.toLocaleString()} and ${TASMANIA_MGA_BOUNDS.easting.max.toLocaleString()}`
		};
	}

	// Check northing range
	if (northing < TASMANIA_MGA_BOUNDS.northing.min || northing > TASMANIA_MGA_BOUNDS.northing.max) {
		return {
			isValid: false,
			error: `Northing must be between ${TASMANIA_MGA_BOUNDS.northing.min.toLocaleString()} and ${TASMANIA_MGA_BOUNDS.northing.max.toLocaleString()}`
		};
	}

	return { isValid: true };
}

// Proj4 definitions for coordinate systems
// GDA2020 MGA Zone 55 (EPSG:7855)
const MGA_ZONE_55 = '+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';

// WGS84 Geographic (EPSG:4326)
const WGS84 = 'EPSG:4326';

/**
 * Convert MGA Zone 55 coordinates to WGS84 lat/long
 * Uses proj4js for fast, reliable browser-based coordinate transformation
 * Converts from GDA2020 MGA Zone 55 to WGS84 (EPSG:4326)
 */
export function convertMGAToLatLong(
	easting: number,
	northing: number
): LatLongCoordinate {
	// Validate coordinates first
	const validation = validateMGACoordinates(easting, northing);
	if (!validation.isValid) {
		throw new Error(validation.error);
	}

	// Check if we're in the browser
	if (!browser) {
		throw new Error('Coordinate conversion is only available in the browser');
	}

	try {
		// Convert from MGA Zone 55 to WGS84 using proj4
		const result = proj4(MGA_ZONE_55, WGS84, [easting, northing]);
		
		const longitude = result[0];
		const latitude = result[1];

		// Validate the result is within reasonable bounds for Tasmania
		if (latitude < -44 || latitude > -39 || longitude < 144 || longitude > 149) {
			throw new Error(
				'Converted coordinates are outside Tasmania bounds. Please check your input.'
			);
		}

		return {
			latitude,
			longitude
		};
	} catch (error) {
		console.error('Coordinate conversion error:', error);

		if (error instanceof Error) {
			throw new Error(`Coordinate conversion failed: ${error.message}`);
		} else {
			throw new Error('Coordinate conversion failed: Unknown error');
		}
	}
}

/**
 * Parse coordinate input string and extract easting/northing
 * Supports various input formats:
 * - "523456 5248123" (space separated)
 * - "523456, 5248123" (comma separated)
 * - "523456,5248123" (comma separated, no space)
 */
export function parseCoordinateInput(input: string): MGACoordinate | null {
	if (!input || typeof input !== 'string') {
		return null;
	}

	// Clean the input - remove extra spaces and normalize separators
	const cleaned = input
		.trim()
		.replace(/\s*,\s*/g, ' ')
		.replace(/\s+/g, ' ');

	// Split by space
	const parts = cleaned.split(' ');

	if (parts.length !== 2) {
		return null;
	}

	const easting = parseFloat(parts[0]);
	const northing = parseFloat(parts[1]);

	if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
		return null;
	}

	return { easting, northing };
}

/**
 * Format MGA coordinates for display
 */
export function formatMGACoordinates(easting: number, northing: number): string {
	return `${easting.toLocaleString()} E, ${northing.toLocaleString()} N`;
}

/**
 * Format lat/long coordinates for display
 */
export function formatLatLongCoordinates(latitude: number, longitude: number): string {
	return `${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°`;
}

/**
 * Get example MGA coordinates for Tasmania (for help text)
 */
export function getExampleCoordinates(): MGACoordinate[] {
	return [
		{ easting: 523456, northing: 5248123 }, // Hobart area
		{ easting: 448234, northing: 5478567 }, // Launceston area
		{ easting: 376123, northing: 5398234 } // Devonport area
	];
}
