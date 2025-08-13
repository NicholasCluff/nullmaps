<script lang="ts">
	import { mapStore } from '../../stores/mapStore.js';
	import {
		convertMGAToLatLong,
		parseCoordinateInput,
		validateMGACoordinates,
		formatMGACoordinates,
		formatLatLongCoordinates,
		type MGACoordinate
	} from '../../services/coordinateService.js';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let eastingInput = $state('');
	let northingInput = $state('');
	let combinedInput = $state('');
	let isConverting = $state(false);
	let error: string | null = $state(null);
	let success: string | null = $state(null);
	let inputMode: 'separate' | 'combined' = $state('combined');


	function clearInputs() {
		eastingInput = '';
		northingInput = '';
		combinedInput = '';
		error = null;
		success = null;
	}

	function switchInputMode(mode: 'separate' | 'combined') {
		inputMode = mode;
		clearInputs();
	}

	function handleGoToCoordinates() {
		error = null;
		success = null;
		isConverting = true;

		try {
			let coords: MGACoordinate | null = null;

			if (inputMode === 'combined') {
				coords = parseCoordinateInput(combinedInput?.toString() || '');
				if (!coords) {
					throw new Error('Invalid coordinate format. Please use "easting northing" or "easting, northing"');
				}
			} else {
				const easting = parseFloat(eastingInput?.toString() || '');
				const northing = parseFloat(northingInput?.toString() || '');
				
				if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
					throw new Error('Please enter valid numbers for both easting and northing');
				}
				
				coords = { easting, northing };
			}

			// Validate coordinates
			const validation = validateMGACoordinates(coords.easting, coords.northing);
			if (!validation.isValid) {
				throw new Error(validation.error);
			}

			// Convert MGA to lat/long
			const latLong = convertMGAToLatLong(coords.easting, coords.northing);

			// Navigate to the coordinates
			mapStore.flyTo([latLong.longitude, latLong.latitude], 16);

			// Add marker at the coordinate location
			const coordinateInfo = `${formatMGACoordinates(coords.easting, coords.northing)}\n${formatLatLongCoordinates(latLong.latitude, latLong.longitude)}`;
			mapStore.addCoordinateMarker(latLong.longitude, latLong.latitude, coordinateInfo);

			// Show success message
			success = `Navigated to ${formatMGACoordinates(coords.easting, coords.northing)} (${formatLatLongCoordinates(latLong.latitude, latLong.longitude)})`;

			// Clear inputs after successful navigation
			setTimeout(() => {
				clearInputs();
				onClose();
			}, 2000);

		} catch (err) {
			console.error('Coordinate conversion error:', err);
			error = err instanceof Error ? err.message : 'Failed to convert coordinates';
		} finally {
			isConverting = false;
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

</script>

<!-- Mobile-first overlay design -->
{#if isOpen}
	<div
		class="coordinate-overlay"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="dialog"
		aria-modal="true"
		aria-label="Go to coordinates"
		tabindex="-1"
	>
		<div class="coordinate-panel">
			<!-- Header -->
			<div class="panel-header">
				<div class="header-content">
					<h2 class="panel-title">Go to Coordinates</h2>
					<button class="close-button" onclick={onClose} aria-label="Close">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
				<p class="panel-description">Enter MGA Zone 55 coordinates (Tasmania)</p>
			</div>

			<!-- Content -->
			<div class="panel-content">
				<!-- Input mode toggle -->
				<div class="input-mode-toggle">
					<button
						class="mode-button"
						class:active={inputMode === 'combined'}
						onclick={() => switchInputMode('combined')}
					>
						Combined Input
					</button>
					<button
						class="mode-button"
						class:active={inputMode === 'separate'}
						onclick={() => switchInputMode('separate')}
					>
						Separate Fields
					</button>
				</div>

				<!-- Input fields -->
				<div class="input-section">
					{#if inputMode === 'combined'}
						<div class="input-group">
							<label for="combined-input" class="input-label">
								Easting, Northing
							</label>
							<input
								id="combined-input"
								type="text"
								bind:value={combinedInput}
								placeholder="523456, 5248123"
								class="coordinate-input"
								disabled={isConverting}
							/>
							<span class="input-hint">Enter as "easting, northing" or "easting northing"</span>
						</div>
					{:else}
						<div class="input-group">
							<label for="easting-input" class="input-label">
								Easting (X)
							</label>
							<input
								id="easting-input"
								type="number"
								bind:value={eastingInput}
								placeholder="523456"
								class="coordinate-input"
								disabled={isConverting}
							/>
						</div>
						
						<div class="input-group">
							<label for="northing-input" class="input-label">
								Northing (Y)
							</label>
							<input
								id="northing-input"
								type="number"
								bind:value={northingInput}
								placeholder="5248123"
								class="coordinate-input"
								disabled={isConverting}
							/>
						</div>
					{/if}
				</div>


				<!-- Status messages -->
				{#if error}
					<div class="status-message error">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="15" y1="9" x2="9" y2="15"></line>
							<line x1="9" y1="9" x2="15" y2="15"></line>
						</svg>
						{error}
					</div>
				{/if}

				{#if success}
					<div class="status-message success">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="20,6 9,17 4,12"></polyline>
						</svg>
						{success}
					</div>
				{/if}

				<!-- Go button -->
				<div class="action-section">
					<button
						class="go-button"
						onclick={handleGoToCoordinates}
						disabled={isConverting || (!combinedInput?.toString().trim() && (!eastingInput?.toString().trim() || !northingInput?.toString().trim()))}
					>
						{#if isConverting}
							<div class="loading-spinner"></div>
							Converting...
						{:else}
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="12" cy="12" r="10"></circle>
								<polyline points="12,6 12,12 16,14"></polyline>
							</svg>
							Go to Location
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.coordinate-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 1100;
		backdrop-filter: blur(2px);
	}

	.coordinate-panel {
		background: white;
		border-radius: 16px 16px 0 0;
		width: 100%;
		max-width: 640px;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		animation: slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.panel-header {
		padding: 20px 20px 0 20px;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.panel-title {
		font-size: 20px;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.panel-description {
		font-size: 14px;
		color: #6b7280;
		margin: 0 0 16px 0;
	}

	.close-button {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		background: #f3f4f6;
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.close-button:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px;
		min-height: 0;
	}

	.input-mode-toggle {
		display: flex;
		background: #f3f4f6;
		border-radius: 8px;
		padding: 4px;
		margin-bottom: 24px;
	}

	.mode-button {
		flex: 1;
		padding: 8px 16px;
		background: none;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
	}

	.mode-button.active {
		background: white;
		color: #1f2937;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.input-section {
		margin-bottom: 24px;
	}

	.input-group {
		margin-bottom: 16px;
	}

	.input-label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: #374151;
		margin-bottom: 6px;
	}

	.coordinate-input {
		width: 100%;
		height: 48px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		padding: 0 16px;
		font-size: 16px;
		color: #1f2937;
		background: white;
		outline: none;
		transition: border-color 0.2s;
	}

	.coordinate-input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.coordinate-input:disabled {
		background: #f9fafb;
		color: #9ca3af;
	}

	.input-hint {
		display: block;
		font-size: 12px;
		color: #6b7280;
		margin-top: 4px;
	}


	.status-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 14px;
		margin-bottom: 16px;
	}

	.status-message.error {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}

	.status-message.success {
		background: #f0fdf4;
		color: #16a34a;
		border: 1px solid #bbf7d0;
	}

	.action-section {
		padding-top: 16px;
		border-top: 1px solid #e5e7eb;
	}

	.go-button {
		width: 100%;
		height: 48px;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.go-button:hover:not(:disabled) {
		background: #1d4ed8;
		transform: translateY(-1px);
	}

	.go-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		transform: none;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Desktop optimizations */
	@media (min-width: 768px) {
		.coordinate-overlay {
			align-items: center;
		}

		.coordinate-panel {
			border-radius: 12px;
			max-height: 80vh;
			max-width: 480px;
		}
	}

	/* Scrollbar styling */
	.panel-content::-webkit-scrollbar {
		width: 4px;
	}

	.panel-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.panel-content::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}
</style>