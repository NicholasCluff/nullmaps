<script lang="ts">
	import { mapStore, layers, activeLayerIds } from '../../stores/mapStore.js';
	import { SERVICE_GROUPS } from '../../config/listServices.js';

	let expandedGroups = ['basemaps']; // Basemaps expanded by default

	function toggleGroup(groupId: string) {
		if (expandedGroups.includes(groupId)) {
			expandedGroups = expandedGroups.filter((id) => id !== groupId);
		} else {
			expandedGroups = [...expandedGroups, groupId];
		}
	}

	function handleLayerToggle(layerId: string) {
		mapStore.toggleLayer(layerId);
	}

	function handleOpacityChange(layerId: string, event: Event) {
		const target = event.target as HTMLInputElement;
		const opacity = parseFloat(target.value);
		mapStore.setLayerOpacity(layerId, opacity);
	}

	function isLayerActive(layerId: string): boolean {
		return $activeLayerIds.has(layerId);
	}

	function getLayerOpacity(layerId: string): number {
		const layer = $layers.get(layerId);
		return layer ? layer.opacity : 1.0;
	}
</script>

<div class="layer-panel">
	<div class="panel-header">
		<h3>Map Layers</h3>
		<p class="panel-description">Toggle Tasmania LIST service layers</p>
	</div>

	<div class="layer-groups">
		{#each SERVICE_GROUPS as group (group.id)}
			<div class="layer-group">
				<button
					class="group-header"
					class:expanded={expandedGroups.includes(group.id)}
					onclick={() => toggleGroup(group.id)}
					aria-expanded={expandedGroups.includes(group.id)}
				>
					<div class="group-info">
						<h4 class="group-name">{group.name}</h4>
						<p class="group-description">{group.description}</p>
					</div>
					<svg
						class="expand-icon"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polyline points="6,9 12,15 18,9"></polyline>
					</svg>
				</button>

				{#if expandedGroups.includes(group.id)}
					<div class="layer-list">
						{#each group.layers as layer (layer.id)}
							<div class="layer-item">
								<div class="layer-control">
									<label class="layer-toggle">
										<input
											type="checkbox"
											checked={isLayerActive(layer.id)}
											onchange={() => handleLayerToggle(layer.id)}
										/>
										<span class="checkbox-custom"></span>
										<span class="layer-name">{layer.name}</span>
									</label>

									{#if layer.id === 'topographic'}
										<div class="basemap-indicator">
											<span class="basemap-badge">Base</span>
										</div>
									{/if}
								</div>

								{#if isLayerActive(layer.id) && layer.id !== 'topographic'}
									<div class="opacity-control">
										<div class="opacity-label">
											<span>Opacity</span>
											<span class="opacity-value"
												>{Math.round(getLayerOpacity(layer.id) * 100)}%</span
											>
										</div>
										<input
											type="range"
											min="0"
											max="1"
											step="0.1"
											value={getLayerOpacity(layer.id)}
											oninput={(e) => handleOpacityChange(layer.id, e)}
											class="opacity-slider"
											aria-label="Layer opacity"
										/>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="panel-footer">
		<div class="service-info">
			<p class="service-note">Data from Tasmania's Land Information System (LIST)</p>
			<a
				href="https://www.thelist.tas.gov.au"
				target="_blank"
				rel="noopener noreferrer"
				class="service-link"
			>
				Learn more about LIST services
			</a>
		</div>
	</div>
</div>

<style>
	.layer-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: white;
		flex-shrink: 0;
	}

	.panel-header h3 {
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 4px 0;
	}

	.panel-description {
		font-size: 14px;
		color: #6b7280;
		margin: 0;
	}

	.layer-groups {
		flex: 1;
		overflow-y: auto;
	}

	.layer-group {
		border-bottom: 1px solid #e5e7eb;
	}

	.group-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: none;
		border: none;
		cursor: pointer;
		transition: background-color 0.2s;
		text-align: left;
	}

	.group-header:hover {
		background: #f9fafb;
	}

	.group-header.expanded {
		background: #f3f4f6;
	}

	.group-info {
		flex: 1;
	}

	.group-name {
		font-size: 16px;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 2px 0;
	}

	.group-description {
		font-size: 13px;
		color: #6b7280;
		margin: 0;
		line-height: 1.3;
	}

	.expand-icon {
		color: #9ca3af;
		transition: transform 0.2s;
		flex-shrink: 0;
		margin-left: 12px;
	}

	.group-header.expanded .expand-icon {
		transform: rotate(180deg);
	}

	.layer-list {
		background: #fafafa;
	}

	.layer-item {
		padding: 12px 20px 12px 40px;
		border-top: 1px solid #e5e7eb;
	}

	.layer-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.layer-toggle {
		display: flex;
		align-items: center;
		cursor: pointer;
		flex: 1;
	}

	.layer-toggle input[type='checkbox'] {
		display: none;
	}

	.checkbox-custom {
		width: 18px;
		height: 18px;
		border: 2px solid #d1d5db;
		border-radius: 4px;
		margin-right: 12px;
		position: relative;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.layer-toggle input[type='checkbox']:checked + .checkbox-custom {
		background: #2563eb;
		border-color: #2563eb;
	}

	.layer-toggle input[type='checkbox']:checked + .checkbox-custom::after {
		content: '';
		position: absolute;
		top: 1px;
		left: 5px;
		width: 4px;
		height: 8px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.layer-name {
		font-size: 14px;
		color: #374151;
		font-weight: 500;
	}

	.basemap-indicator {
		flex-shrink: 0;
	}

	.basemap-badge {
		background: #f3f4f6;
		color: #6b7280;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.opacity-control {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #e5e7eb;
	}

	.opacity-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: #6b7280;
		margin-bottom: 8px;
	}

	.opacity-value {
		font-weight: 600;
		color: #374151;
	}

	.opacity-slider {
		width: 100%;
		height: 4px;
		background: #e5e7eb;
		border-radius: 2px;
		outline: none;
		appearance: none;
		cursor: pointer;
	}

	.opacity-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		cursor: pointer;
	}

	.opacity-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #2563eb;
		border-radius: 50%;
		border: none;
		cursor: pointer;
	}

	.panel-footer {
		padding: 20px;
		border-top: 1px solid #e5e7eb;
		background: white;
		flex-shrink: 0;
	}

	.service-info {
		text-align: center;
	}

	.service-note {
		font-size: 12px;
		color: #6b7280;
		margin: 0 0 8px 0;
		line-height: 1.4;
	}

	.service-link {
		color: #2563eb;
		text-decoration: none;
		font-size: 12px;
		font-weight: 500;
	}

	.service-link:hover {
		text-decoration: underline;
	}

	/* Scrollbar styling */
	.layer-groups::-webkit-scrollbar {
		width: 4px;
	}

	.layer-groups::-webkit-scrollbar-track {
		background: transparent;
	}

	.layer-groups::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.layer-groups::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}
</style>
