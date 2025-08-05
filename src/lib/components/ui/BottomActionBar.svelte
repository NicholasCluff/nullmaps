<script lang="ts">
	import {
		mapStore,
		activeLayerIds,
		activeDynamicLayerIds,
		bearing
	} from '../../stores/mapStore.js';

	export let onLayersToggle = () => {};
	export let onShareMap = () => {};

	let isLocating = false;
	let locationError: string | null = null;

	async function handleLocationClick() {
		if (isLocating) return;

		isLocating = true;
		locationError = null;

		try {
			await mapStore.goToUserLocation();
		} catch (error) {
			locationError = error instanceof Error ? error.message : 'Location unavailable';
			setTimeout(() => {
				locationError = null;
			}, 3000);
		} finally {
			isLocating = false;
		}
	}

	function handleHomeClick() {
		mapStore.resetToTasmania();
	}

	function handleCompassClick() {
		mapStore.resetBearing();
	}

	function handleShareClick() {
		if (navigator.share) {
			navigator
				.share({
					title: 'NullMaps Tasmania',
					text: 'Check out this location on NullMaps Tasmania',
					url: window.location.href
				})
				.catch(console.error);
		} else {
			// Fallback: copy URL to clipboard
			navigator.clipboard
				.writeText(window.location.href)
				.then(() => {
					onShareMap();
				})
				.catch(console.error);
		}
	}

	// Calculate number of active layers (excluding basemap)
	$: staticActiveCount = $activeLayerIds.size > 0 ? $activeLayerIds.size - 1 : 0;
	$: dynamicActiveCount = $activeDynamicLayerIds.size;
	$: activeLayerCount = staticActiveCount + dynamicActiveCount;

	// Check if compass is rotated (bearing is not 0)
	$: isCompassActive = Math.abs($bearing) > 1; // 1 degree tolerance
</script>

<div class="bottom-action-bar">
	{#if locationError}
		<div class="error-toast">
			{locationError}
		</div>
	{/if}

	<div class="action-buttons">
		<!-- Current location button -->
		<button
			class="action-button location-button"
			class:loading={isLocating}
			class:error={locationError}
			onclick={handleLocationClick}
			disabled={isLocating}
			aria-label="Go to current location"
			title="Current location"
		>
			{#if isLocating}
				<svg
					class="spinner"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" opacity="0.3"></circle>
					<path d="M12 2v4M12 18v4M22 12h-4M6 12H2" opacity="1"></path>
				</svg>
			{:else}
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<circle cx="12" cy="12" r="4"></circle>
					<path d="M12 2v2M12 20v2M22 12h-2M4 12H2"></path>
				</svg>
			{/if}
		</button>

		<!-- Home/Reset view button -->
		<button
			class="action-button"
			onclick={handleHomeClick}
			aria-label="Reset to Tasmania view"
			title="Home view"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
				<polyline points="9,22 9,12 15,12 15,22"></polyline>
			</svg>
		</button>

		<!-- Compass/Reset bearing button -->
		<button
			class="action-button compass-button"
			class:compass-active={isCompassActive}
			onclick={handleCompassClick}
			aria-label="Reset map bearing to north"
			title="Reset to north"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				style="transform: rotate({$bearing}deg); transition: transform 0.3s ease;"
			>
				<circle cx="12" cy="12" r="10"></circle>
				<polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" fill="currentColor"></polygon>
				<path d="M12 2v4"></path>
				<text x="12" y="6" text-anchor="middle" font-size="8" font-weight="bold" fill="currentColor"
					>N</text
				>
			</svg>
		</button>

		<!-- Layers toggle button -->
		<button
			class="action-button layers-button"
			class:has-active={activeLayerCount > 0}
			onclick={onLayersToggle}
			aria-label="Toggle layers panel"
			title="Map layers"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polygon points="12,2 2,7 12,12 22,7"></polygon>
				<polyline points="2,17 12,22 22,17"></polyline>
				<polyline points="2,12 12,17 22,12"></polyline>
			</svg>
			{#if activeLayerCount > 0}
				<span class="layer-count">{activeLayerCount}</span>
			{/if}
		</button>

		<!-- Share button -->
		<button
			class="action-button"
			onclick={handleShareClick}
			aria-label="Share map"
			title="Share location"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="18" cy="5" r="3"></circle>
				<circle cx="6" cy="12" r="3"></circle>
				<circle cx="18" cy="19" r="3"></circle>
				<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
				<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
			</svg>
		</button>
	</div>
</div>

<style>
	.bottom-action-bar {
		position: fixed;
		bottom: 20px;
		right: 20px;
		z-index: 1000;
		pointer-events: none;
	}

	.error-toast {
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: 8px;
		background: #dc2626;
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 14px;
		white-space: nowrap;
		pointer-events: auto;
		animation: slideUp 0.2s ease-out;
	}

	.error-toast::after {
		content: '';
		position: absolute;
		top: 100%;
		right: 20px;
		border: 6px solid transparent;
		border-top-color: #dc2626;
	}

	.action-buttons {
		display: flex;
		flex-direction: column;
		gap: 8px;
		pointer-events: auto;
	}

	.action-button {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: white;
		border: none;
		border-radius: 12px;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(10px);
	}

	.action-button:hover {
		background: #f9fafb;
		color: #1f2937;
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.action-button:active {
		transform: translateY(0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.action-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.location-button.loading {
		color: #2563eb;
	}

	.location-button.error {
		background: #fef2f2;
		color: #dc2626;
	}

	.layers-button.has-active {
		background: #eff6ff;
		color: #2563eb;
	}

	.compass-button:hover {
		background: #f0f9ff;
		color: #0369a1;
	}

	.compass-button.compass-active {
		background: #fef3c7;
		color: #d97706;
	}

	.compass-button.compass-active:hover {
		background: #fde68a;
		color: #b45309;
	}

	.layer-count {
		position: absolute;
		top: -4px;
		right: -4px;
		background: #2563eb;
		color: white;
		font-size: 10px;
		font-weight: 600;
		min-width: 18px;
		height: 18px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	.spinner {
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

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.bottom-action-bar {
			bottom: 16px;
			right: 16px;
		}

		.action-button {
			width: 44px;
			height: 44px;
			border-radius: 10px;
		}

		.error-toast {
			font-size: 13px;
			padding: 6px 10px;
			max-width: 200px;
			white-space: normal;
			word-wrap: break-word;
		}
	}

	/* Ensure proper touch targets */
	@media (pointer: coarse) {
		.action-button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
