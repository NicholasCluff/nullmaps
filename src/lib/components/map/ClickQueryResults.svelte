<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { ClickQueryResult } from '../../services/clickQueryService.js';
	import {
		formatClickResults,
		type FormattedClickResults
	} from '../../services/clickQueryService.js';
	import { mapStore } from '../../stores/mapStore.js';

	interface Props {
		results: ClickQueryResult[];
		loading: boolean;
		error: string | null;
		clickLocation: { x: number; y: number } | null;
		onClose: () => void;
	}

	let { results, loading, error, clickLocation, onClose }: Props = $props();

	// Format results for display
	const formattedResults: FormattedClickResults = $derived(formatClickResults(results));
	const hasResults = $derived(results.length > 0);

	// Expand/collapse state for each layer group
	let expandedLayers: Set<string> = $state(new Set());

	function toggleLayer(layerName: string) {
		if (expandedLayers.has(layerName)) {
			expandedLayers.delete(layerName);
		} else {
			expandedLayers.add(layerName);
		}
		expandedLayers = new SvelteSet(expandedLayers); // Trigger reactivity
	}

	function handleFeatureClick(result: ClickQueryResult) {
		// Zoom to the feature if it has geometry
		if (result.geometry && result.geometry.type === 'Point') {
			const [lng, lat] = result.geometry.coordinates as [number, number];
			mapStore.flyTo([lng, lat], 16);
		} else if (result.bbox) {
			const [minX, minY, maxX, maxY] = result.bbox;
			mapStore.fitToBounds([
				[minX, minY],
				[maxX, maxY]
			]);
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<!-- Mobile-first overlay design -->
<div
	class="click-results-overlay"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="dialog"
	aria-modal="true"
	aria-label="Feature query results"
	tabindex="-1"
>
	<div class="click-results-panel">
		<!-- Header with location and close button -->
		<div class="panel-header">
			<div class="header-content">
				<div class="location-info">
					{#if clickLocation}
						<div class="coordinates">
							{clickLocation.x.toFixed(4)}, {clickLocation.y.toFixed(4)}
						</div>
					{/if}
				</div>
				<button class="close-button" onclick={onClose} aria-label="Close results">
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

			<!-- Status bar -->
			<div class="status-bar">
				{#if loading}
					<div class="status loading">
						<div class="loading-spinner"></div>
						<span>Querying features...</span>
					</div>
				{:else if error}
					<div class="status error">
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
						<span>{error}</span>
					</div>
				{:else}
					<div class="status success">
						<h3>{formattedResults.title}</h3>
						<p>{formattedResults.subtitle}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Results content -->
		<div class="panel-content">
			{#if loading}
				<!-- Loading state -->
				<div class="loading-content">
					<div class="loading-message">Searching for features at this location...</div>
				</div>
			{:else if error}
				<!-- Error state -->
				<div class="error-content">
					<div class="error-message">{error}</div>
					<button class="retry-button" onclick={() => window.location.reload()}> Try Again </button>
				</div>
			{:else if !hasResults}
				<!-- No results state -->
				<div class="empty-content">
					<svg
						width="48"
						height="48"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
					</svg>
					<h4>No features found</h4>
					<p>No map features were found at this location. Try clicking on a visible layer.</p>
				</div>
			{:else}
				<!-- Results by layer -->
				<div class="results-content">
					{#each formattedResults.layerGroups as layerGroup (layerGroup.layerName)}
						<div class="layer-group">
							<button
								class="layer-header"
								class:expanded={expandedLayers.has(layerGroup.layerName)}
								onclick={() => toggleLayer(layerGroup.layerName)}
							>
								<div class="layer-info">
									<h4>{layerGroup.layerName}</h4>
									<span class="feature-count">
										{layerGroup.features.length} feature{layerGroup.features.length !== 1
											? 's'
											: ''}
									</span>
								</div>
								<svg
									class="expand-icon"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="6,9 12,15 18,9"></polyline>
								</svg>
							</button>

							{#if expandedLayers.has(layerGroup.layerName)}
								<div class="features-list">
									{#each layerGroup.features as feature, index (index)}
										{@const result = results.find((r) => r.displayName === feature.title)}
										<div class="feature-item">
											<button
												class="feature-header"
												onclick={() => result && handleFeatureClick(result)}
											>
												<div class="feature-info">
													<h5>{feature.title}</h5>
													{#if feature.subtitle}
														<p class="feature-subtitle">{feature.subtitle}</p>
													{/if}
												</div>
												{#if result?.geometry || result?.bbox}
													<div class="zoom-icon">
														<svg
															width="14"
															height="14"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2"
														>
															<circle cx="11" cy="11" r="8"></circle>
															<path d="m21 21-4.35-4.35"></path>
															<circle cx="11" cy="11" r="3"></circle>
														</svg>
													</div>
												{/if}
											</button>

											{#if feature.attributes.length > 0}
												<div class="feature-attributes">
													{#each feature.attributes as attr (attr.key)}
														<div class="attribute-row">
															<span class="attribute-key">{attr.key}:</span>
															<span class="attribute-value">{attr.value}</span>
														</div>
													{/each}
												</div>
											{/if}

											{#if feature.externalLinks && feature.externalLinks.length > 0}
												<div class="external-links">
													{#each feature.externalLinks as link (link.url)}
														<a
															href={link.url}
															target="_blank"
															rel="noopener noreferrer"
															class="external-link"
															title={link.description}
														>
															<span class="link-text">{link.label}</span>
															<svg
																class="external-icon"
																width="12"
																height="12"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
															>
																<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
																></path>
																<polyline points="15,3 21,3 21,9"></polyline>
																<line x1="10" y1="14" x2="21" y2="3"></line>
															</svg>
														</a>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.click-results-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
	}

	.click-results-panel {
		background: white;
		border-radius: 16px 16px 0 0;
		width: 100%;
		max-width: 640px;
		max-height: 70vh;
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
		margin-bottom: 12px;
	}

	.location-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.coordinates {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
		font-size: 12px;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 4px;
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
	}

	.close-button:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.status-bar {
		padding-bottom: 16px;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status.loading {
		color: #2563eb;
	}

	.status.error {
		color: #dc2626;
	}

	.status.success h3 {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.status.success p {
		font-size: 14px;
		color: #6b7280;
		margin: 2px 0 0 0;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #e5e7eb;
		border-top: 2px solid #2563eb;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
		min-height: 0;
	}

	.loading-content,
	.error-content,
	.empty-content {
		padding: 40px 20px;
		text-align: center;
		color: #6b7280;
	}

	.empty-content svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-content h4 {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 500;
		color: #374151;
	}

	.empty-content p {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
	}

	.error-message {
		color: #dc2626;
		margin-bottom: 16px;
	}

	.retry-button {
		padding: 8px 16px;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
	}

	.results-content {
		padding: 0;
	}

	.layer-group {
		border-bottom: 1px solid #e5e7eb;
	}

	.layer-header {
		width: 100%;
		padding: 16px 20px;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		text-align: left;
		transition: background-color 0.2s;
	}

	.layer-header:hover {
		background: #f9fafb;
	}

	.layer-header.expanded {
		background: #f3f4f6;
	}

	.layer-info h4 {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 2px 0;
	}

	.feature-count {
		font-size: 12px;
		color: #6b7280;
	}

	.expand-icon {
		color: #9ca3af;
		transition: transform 0.2s;
		flex-shrink: 0;
	}

	.layer-header.expanded .expand-icon {
		transform: rotate(180deg);
	}

	.features-list {
		background: #fafafa;
	}

	.feature-item {
		border-top: 1px solid #e5e7eb;
	}

	.feature-header {
		width: 100%;
		padding: 12px 20px 12px 40px;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		text-align: left;
		transition: background-color 0.2s;
	}

	.feature-header:hover {
		background: #f3f4f6;
	}

	.feature-info h5 {
		font-size: 14px;
		font-weight: 500;
		color: #1f2937;
		margin: 0 0 2px 0;
		line-height: 1.4;
	}

	.feature-subtitle {
		font-size: 12px;
		color: #6b7280;
		margin: 0;
		line-height: 1.3;
	}

	.zoom-icon {
		color: #6b7280;
		flex-shrink: 0;
		margin-left: 12px;
		margin-top: 2px;
	}

	.feature-attributes {
		padding: 8px 20px 12px 40px;
		background: #f9fafb;
	}

	.attribute-row {
		display: flex;
		margin-bottom: 4px;
		font-size: 12px;
		line-height: 1.4;
	}

	.attribute-key {
		font-weight: 500;
		color: #374151;
		min-width: 80px;
		margin-right: 8px;
		flex-shrink: 0;
	}

	.attribute-value {
		color: #6b7280;
		word-break: break-word;
	}

	.external-links {
		padding: 8px 20px 12px 40px;
		background: #f9fafb;
		border-top: 1px solid #e5e7eb;
	}

	.external-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #2563eb;
		color: white;
		text-decoration: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.2s;
		margin-right: 8px;
		margin-bottom: 4px;
	}

	.external-link:hover {
		background: #1d4ed8;
		transform: translateY(-1px);
	}

	.external-link:active {
		transform: translateY(0);
	}

	.link-text {
		line-height: 1;
	}

	.external-icon {
		flex-shrink: 0;
		opacity: 0.8;
	}

	/* Desktop optimizations */
	@media (min-width: 768px) {
		.click-results-overlay {
			align-items: center;
		}

		.click-results-panel {
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

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
