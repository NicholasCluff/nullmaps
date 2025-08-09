<script lang="ts">
	export let isOpen = false;

	function closeDrawer() {
		isOpen = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDrawer();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isOpen) {
			closeDrawer();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div class="drawer-backdrop" onclick={handleBackdropClick} role="presentation">
		<div
			class="drawer-panel"
			class:open={isOpen}
			role="dialog"
			aria-modal="true"
			aria-label="Navigation menu"
		>
			<!-- Drawer header -->
			<div class="drawer-header">
				<div class="drawer-title">
					<h2>NullMaps Tasmania</h2>
					<p>LIST Services</p>
				</div>
				<button class="close-button" onclick={closeDrawer} aria-label="Close menu">
					<svg
						width="24"
						height="24"
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

			<!-- Drawer content -->
			<div class="drawer-content">
				<slot />
			</div>

			<!-- Drawer footer -->
			<div class="drawer-footer">
				<!-- <div class="footer-links">
					<a href="https://www.thelist.tas.gov.au" target="_blank" rel="noopener noreferrer">
						About LIST
					</a>
					<a
						href="https://github.com/yourusername/nullmaps"
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
				</div> -->
				<div class="footer-attribution">
					<p>© State of Tasmania</p>
					<p>Department of Natural Resources and Environment Tasmania</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		animation: fadeIn 0.2s ease-out;
	}

	.drawer-panel {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 320px;
		max-width: calc(100vw - 64px);
		background: white;
		box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
		transform: translateX(-100%);
		transition: transform 0.3s ease-out;
	}

	.drawer-panel.open {
		transform: translateX(0);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px;
		border-bottom: 1px solid #e5e7eb;
		background: #f9fafb;
		flex-shrink: 0;
	}

	.drawer-title h2 {
		font-size: 20px;
		font-weight: 700;
		color: #1f2937;
		margin: 0;
		line-height: 1.2;
	}

	.drawer-title p {
		font-size: 14px;
		color: #6b7280;
		margin: 2px 0 0 0;
		line-height: 1.2;
	}

	.close-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: none;
		border: none;
		border-radius: 6px;
		color: #6b7280;
		cursor: pointer;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.close-button:hover {
		background: rgba(0, 0, 0, 0.05);
		color: #374151;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	.drawer-footer {
		padding: 20px;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
		flex-shrink: 0;
	}

	.footer-attribution {
		font-size: 12px;
		color: #6b7280;
		line-height: 1.4;
	}

	.footer-attribution p {
		margin: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	/* Mobile optimizations */
	@media (max-width: 480px) {
		.drawer-panel {
			width: 100%;
			max-width: calc(100vw - 32px);
		}

		.drawer-header {
			padding: 16px;
		}

		.drawer-footer {
			padding: 16px;
		}
	}

	/* Ensure proper scroll behavior */
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
