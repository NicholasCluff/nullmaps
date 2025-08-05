<script lang="ts">
	import { mapStore, activeDynamicLayerIds, dynamicLayers, dynamicLayerOrder } from '../../stores/mapStore.js';
	import { flip } from 'svelte/animate';
	import { dndzone } from 'svelte-dnd-action';

	let drawerOpen = false;

	// Convert active layers to draggable format using the stored order
	$: activeLayersList = $dynamicLayerOrder
		.filter(layerId => $activeDynamicLayerIds.has(layerId))
		.map(layerId => {
			const layer = $dynamicLayers.get(layerId);
			return {
				id: layerId,
				name: layer?.name || layerId,
				serviceName: layer?.serviceName || '',
				type: layer?.type || 'Feature Layer'
			};
		}).reverse(); // Reverse to show top-most layers first in the drawer

	function handleDndConsider(e: CustomEvent) {
		activeLayersList = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent) {
		activeLayersList = e.detail.items;
		
		// Update layer order in map - reverse because we show top layers first
		const newOrder = activeLayersList.map(item => item.id).reverse();
		mapStore.reorderDynamicLayers(newOrder);
	}

	function toggleDrawer() {
		drawerOpen = !drawerOpen;
	}

	function removeLayer(layerId: string) {
		mapStore.toggleDynamicLayer(layerId);
	}
</script>

<!-- Drawer Toggle Button -->
<button class="drawer-toggle" class:open={drawerOpen} onclick={toggleDrawer}>
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<rect x="3" y="3" width="18" height="18" rx="2"/>
		<path d="M9 3v18"/>
		<path d="m16 15-3-3 3-3"/>
	</svg>
	<span>Layers ({activeLayersList.length})</span>
</button>

<!-- Drawer -->
<div class="layers-drawer" class:open={drawerOpen}>
	<div class="drawer-header">
		<h3>Active Layers</h3>
		<p class="drawer-description">Drag to reorder • Top layers render above</p>
		<button class="close-button" onclick={toggleDrawer}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	</div>

	<div class="drawer-content">
		{#if activeLayersList.length === 0}
			<div class="empty-state">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
					<path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
					<path d="M3 12h18"/>
				</svg>
				<p>No active layers</p>
				<span>Enable layers from the panel to manage their order</span>
			</div>
		{:else}
			<div 
				class="layer-list"
				use:dndzone={{
					items: activeLayersList,
					dragDisabled: false,
					dropTargetStyle: {},
					morphDisabled: true
				}}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
			>
				{#each activeLayersList as layer (layer.id)}
					<div 
						class="layer-item"
						animate:flip={{ duration: 200 }}
					>
						<div class="drag-handle">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<circle cx="9" cy="12" r="1"/>
								<circle cx="9" cy="5" r="1"/>
								<circle cx="9" cy="19" r="1"/>
								<circle cx="15" cy="12" r="1"/>
								<circle cx="15" cy="5" r="1"/>
								<circle cx="15" cy="19" r="1"/>
							</svg>
						</div>

						<div class="layer-info">
							<div class="layer-name">{layer.name}</div>
							<div class="layer-meta">
								<span class="service-name">{layer.serviceName.replace('Public/', '')}</span>
								<span class="layer-type">{layer.type}</span>
							</div>
						</div>

						<button 
							class="remove-button"
							onclick={() => removeLayer(layer.id)}
							aria-label="Remove layer"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Backdrop -->
{#if drawerOpen}
	<div class="drawer-backdrop" onclick={toggleDrawer}></div>
{/if}

<style>
	.drawer-toggle {
		position: fixed;
		bottom: 80px;
		right: 20px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		font-size: 14px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s;
		z-index: 1000;
	}

	.drawer-toggle:hover {
		background: #f9fafb;
		border-color: #d1d5db;
		box-shadow: 0 6px 8px -2px rgba(0, 0, 0, 0.1);
	}

	.drawer-toggle.open {
		background: #2563eb;
		border-color: #2563eb;
		color: white;
	}

	.drawer-toggle svg {
		transition: transform 0.2s;
	}

	.drawer-toggle.open svg {
		transform: rotate(180deg);
	}

	.layers-drawer {
		position: fixed;
		top: 0;
		right: 0;
		width: 320px;
		height: 100vh;
		background: white;
		border-left: 1px solid #e5e7eb;
		box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
		transform: translateX(100%);
		transition: transform 0.3s ease-in-out;
		z-index: 1100;
		display: flex;
		flex-direction: column;
	}

	.layers-drawer.open {
		transform: translateX(0);
	}

	.drawer-header {
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
		position: relative;
	}

	.drawer-header h3 {
		margin: 0 0 4px 0;
		font-size: 18px;
		font-weight: 600;
		color: #1f2937;
	}

	.drawer-description {
		margin: 0;
		font-size: 13px;
		color: #6b7280;
		line-height: 1.4;
	}

	.close-button {
		position: absolute;
		top: 20px;
		right: 20px;
		padding: 4px;
		background: none;
		border: none;
		color: #9ca3af;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #6b7280;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		text-align: center;
		color: #9ca3af;
		height: 100%;
	}

	.empty-state svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0 0 8px 0;
		font-size: 16px;
		font-weight: 500;
		color: #6b7280;
	}

	.empty-state span {
		font-size: 14px;
		line-height: 1.4;
	}

	.layer-list {
		padding: 0;
	}

	.layer-item {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid #f3f4f6;
		background: white;
		transition: all 0.2s;
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}

	.layer-item:hover {
		background: #f9fafb;
	}

	.layer-item:active {
		cursor: grabbing;
		background: #eff6ff;
		border-color: #dbeafe;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.drag-handle {
		color: #9ca3af;
		margin-right: 12px;
		flex-shrink: 0;
		cursor: grab;
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;
	}

	.layer-item:active .drag-handle {
		cursor: grabbing;
		color: #2563eb;
	}

	.layer-info {
		flex: 1;
		min-width: 0;
	}

	.layer-name {
		font-size: 14px;
		font-weight: 500;
		color: #374151;
		margin-bottom: 4px;
		line-height: 1.3;
		word-break: break-word;
	}

	.layer-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.service-name {
		font-size: 11px;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 3px;
		font-weight: 500;
	}

	.layer-type {
		font-size: 10px;
		color: #1d4ed8;
		background: #eff6ff;
		padding: 2px 6px;
		border-radius: 3px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.remove-button {
		padding: 6px;
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.remove-button:hover {
		background: #fef2f2;
		opacity: 1;
	}

	.drawer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 1050;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.layers-drawer {
			width: 100vw;
		}
		
		.drawer-toggle {
			right: 16px;
			bottom: 70px;
			padding: 10px 14px;
			font-size: 13px;
		}
	}

	/* Scrollbar styling */
	.drawer-content::-webkit-scrollbar {
		width: 4px;
	}

	.drawer-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.drawer-content::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.drawer-content::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}
</style>