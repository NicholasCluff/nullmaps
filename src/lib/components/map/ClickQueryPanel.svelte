<script lang="ts">
	import {
		mapStore,
		clickQueryResults,
		clickQueryLocation,
		clickQueryTimestamp,
		clickQueryPanelVisible
	} from '../../stores/mapStore.js';
	import { formatClickResults } from '../../services/clickQueryService.js';

	// Format results for display
	const formattedResults = $derived(formatClickResults($clickQueryResults));
	const hasResults = $derived($clickQueryResults.length > 0);

	// Expand/collapse state for each layer group
	let expandedLayers: Set<string> = $state(new Set());

	function toggleLayer(layerName: string) {
		if (expandedLayers.has(layerName)) {
			expandedLayers.delete(layerName);
		} else {
			expandedLayers.add(layerName);
		}
		expandedLayers = new Set(expandedLayers); // Trigger reactivity
	}

	function handleFeatureClick(result: any) {
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

	function formatTimestamp(timestamp: number | null): string {
		if (!timestamp) return '';
		return new Date(timestamp).toLocaleTimeString();
	}

	function handleClose() {
		mapStore.toggleClickQueryPanel();
	}

	function handleClear() {
		mapStore.clearClickQueryResults();
	}
</script>

{#if $clickQueryPanelVisible}
	<div class="click-query-panel">
		<!-- Panel header -->
		<div class="panel-header">
			<div class="header-content">
				<h3>Click Query Results</h3>
				<div class="header-actions">
					<button class="clear-button" onclick={handleClear} title="Clear results">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M3 6h18"></path>
							<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
							<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
						</svg>
					</button>
					<button class="close-button" onclick={handleClose} title="Close panel">
						<svg
							width="16"
							height="16"
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
			</div>

			<!-- Query info -->
			{#if $clickQueryLocation}
				<div class="query-info">
					<div class="location">
						<span class="label">Location:</span>
						<span class="coordinates">
							{$clickQueryLocation.x.toFixed(4)}, {$clickQueryLocation.y.toFixed(4)}
						</span>
					</div>
					{#if $clickQueryTimestamp}
						<div class="timestamp">
							<span class="label">Time:</span>
							<span class="time">{formatTimestamp($clickQueryTimestamp)}</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Results content -->
		<div class="panel-content">
			{#if !hasResults}
				<!-- No results state -->
				<div class="empty-content">
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<circle cx="11" cy="11" r="8"></circle>
						<path d="m21 21-4.35-4.35"></path>
					</svg>
					<p>No features found at the clicked location</p>
				</div>
			{:else}
				<!-- Results summary -->
				<div class="results-summary">
					<h4>{formattedResults.title}</h4>
					<p>{formattedResults.subtitle}</p>
				</div>

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
									<span class="layer-name">{layerGroup.layerName}</span>
									<span class="feature-count">
										{layerGroup.features.length} feature{layerGroup.features.length !== 1
											? 's'
											: ''}
									</span>
								</div>
								<svg
									class="expand-icon"
									width="14"
									height="14"
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
										{@const result = $clickQueryResults.find(
											(r) => r.displayName === feature.title
										)}
										<div class="feature-item">
											<button
												class="feature-header"
												onclick={() => result && handleFeatureClick(result)}
											>
												<div class="feature-info">
													<span class="feature-title">{feature.title}</span>
													{#if feature.subtitle}
														<span class="feature-subtitle">{feature.subtitle}</span>
													{/if}
												</div>
												{#if result?.geometry || result?.bbox}
													<div class="zoom-icon">
														<svg
															width="12"
															height="12"
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
													{#each feature.attributes.slice(0, 5) as attr (attr.key)}
														<div class="attribute-row">
															<span class="attribute-key">{attr.key}:</span>
															<span class="attribute-value">{attr.value}</span>
														</div>
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
{/if}

<style>
	.click-query-panel {
		position: fixed;
		top: 60px;
		right: 16px;
		width: 320px;
		max-height: calc(100vh - 140px);
		background: white;
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		z-index: 900;
		overflow: hidden;
	}

	.panel-header {
		padding: 16px;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.header-content h3 {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.clear-button,
	.close-button {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: #f3f4f6;
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-button:hover,
	.close-button:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.query-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
	}

	.location,
	.timestamp {
		display: flex;
		gap: 6px;
	}

	.label {
		font-weight: 500;
		color: #6b7280;
		min-width: 48px;
	}

	.coordinates,
	.time {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
		color: #374151;
		background: #f3f4f6;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 11px;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	.empty-content {
		padding: 32px 16px;
		text-align: center;
		color: #6b7280;
	}

	.empty-content svg {
		margin-bottom: 12px;
		opacity: 0.5;
	}

	.empty-content p {
		margin: 0;
		font-size: 14px;
	}

	.results-summary {
		padding: 16px 16px 8px 16px;
		border-bottom: 1px solid #f3f4f6;
	}

	.results-summary h4 {
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 4px 0;
	}

	.results-summary p {
		font-size: 12px;
		color: #6b7280;
		margin: 0;
	}

	.results-content {
		padding: 0;
	}

	.layer-group {
		border-bottom: 1px solid #f3f4f6;
	}

	.layer-header {
		width: 100%;
		padding: 12px 16px;
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

	.layer-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.layer-name {
		font-size: 13px;
		font-weight: 500;
		color: #1f2937;
	}

	.feature-count {
		font-size: 11px;
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
		padding: 10px 16px 10px 32px;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: space-between;
		text-align: left;
		transition: background-color 0.2s;
	}

	.feature-header:hover {
		background: #f3f4f6;
	}

	.feature-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}

	.feature-title {
		font-size: 12px;
		font-weight: 500;
		color: #1f2937;
		line-height: 1.3;
	}

	.feature-subtitle {
		font-size: 11px;
		color: #6b7280;
		line-height: 1.2;
	}

	.zoom-icon {
		color: #6b7280;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.feature-attributes {
		padding: 8px 16px 10px 32px;
		background: #f9fafb;
		font-size: 11px;
	}

	.attribute-row {
		display: flex;
		margin-bottom: 3px;
		line-height: 1.3;
		gap: 6px;
	}

	.attribute-key {
		font-weight: 500;
		color: #374151;
		min-width: 60px;
		flex-shrink: 0;
	}

	.attribute-value {
		color: #6b7280;
		word-break: break-word;
		flex: 1;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.click-query-panel {
			top: 56px;
			right: 8px;
			left: 8px;
			width: auto;
			max-height: calc(100vh - 120px);
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
		background: rgba(0, 0, 0, 0.1);
		border-radius: 2px;
	}
</style>
