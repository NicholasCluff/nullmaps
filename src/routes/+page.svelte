<script lang="ts">
	import MapContainer from '$lib/components/map/MapContainer.svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import MobileDrawer from '$lib/components/ui/MobileDrawer.svelte';
	import BottomActionBar from '$lib/components/ui/BottomActionBar.svelte';
	import SearchableLayerPanel from '$lib/components/layers/SearchableLayerPanel.svelte';
	import LayersDrawer from '$lib/components/layers/LayersDrawer.svelte';

	let isDrawerOpen = false;

	function toggleDrawer() {
		isDrawerOpen = !isDrawerOpen;
	}

	function handleLayersToggle() {
		isDrawerOpen = true;
	}

	function handleShareMap() {
		// TODO: Implement share success feedback
		console.log('Map shared!');
	}
</script>

<svelte:head>
	<title>NullMaps Tasmania - LIST Services</title>
	<meta name="description" content="Mobile-first web map for Tasmania LIST services" />
</svelte:head>

<AppHeader onMenuToggle={toggleDrawer} />

<!-- Always render SearchableLayerPanel to load layers on startup -->
<div style="display: none;">
	<SearchableLayerPanel />
</div>

<MobileDrawer bind:isOpen={isDrawerOpen}>
	<SearchableLayerPanel />
</MobileDrawer>

<main class="app-main">
	<MapContainer />
</main>

<LayersDrawer />

<BottomActionBar onLayersToggle={handleLayersToggle} onShareMap={handleShareMap} />

<style>
	.app-main {
		position: fixed;
		top: 60px; /* Account for header height */
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
	}

	:global(html, body) {
		height: 100%;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	/* Mobile header height adjustment */
	@media (max-width: 768px) {
		.app-main {
			top: 56px;
		}
	}
</style>
