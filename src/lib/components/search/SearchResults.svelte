<script lang="ts">
	import type { SearchResult } from '../../services/searchService.js';

	interface Props {
		results: SearchResult[];
		loading: boolean;
		error: string | null;
		query: string;
		onResultClick: (result: SearchResult) => void;
		onClear: () => void;
	}

	let { results, loading, error, query, onResultClick, onClear }: Props = $props();

	function handleResultClick(result: SearchResult) {
		onResultClick(result);
		// The zoom handling is now done in the AppHeader via mapStore.zoomToSearchResult
		// This avoids duplicate zoom calls
	}

	function getResultIcon(result: SearchResult): string {
		if (!result.geometry) return '📍';

		switch (result.geometry.type) {
			case 'Point':
				return '📍';
			case 'Polyline':
				return '📏';
			case 'Polygon':
				return '🔷';
			default:
				return '📍';
		}
	}

	function truncateText(text: string, maxLength: number = 40): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<div class="search-results">
	{#if loading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<span>Searching features...</span>
		</div>
	{:else if error}
		<div class="error-state">
			<svg
				width="20"
				height="20"
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
	{:else if results.length > 0}
		<div class="results-header">
			<span class="results-count"
				>{results.length} result{results.length === 1 ? '' : 's'} for "{query}"</span
			>
			<button class="clear-button" onclick={onClear} aria-label="Clear search">
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

		<div class="results-list">
			{#each results as result (result.id)}
				<button
					class="result-item"
					onclick={() => handleResultClick(result)}
					title="Click to zoom to this feature"
				>
					<div class="result-icon">
						{getResultIcon(result)}
					</div>
					<div class="result-content">
						<div class="result-name">
							{truncateText(result.displayName || 'Unnamed Feature')}
						</div>
						{#if result.displayValue}
							<div class="result-value">
								{truncateText(result.displayValue)}
							</div>
						{/if}
						<div class="result-meta">
							<span class="layer-name">{truncateText(result.layerName, 25)}</span>
							<span class="service-name">{truncateText(result.serviceName, 20)}</span>
						</div>
					</div>
					<div class="result-action">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M15 3h6v6"></path>
							<path d="M21 3l-7 7"></path>
							<path d="M14 14v7H3v-7"></path>
						</svg>
					</div>
				</button>
			{/each}
		</div>
	{:else if query.trim()}
		<div class="empty-state">
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
			<div class="empty-title">No features found</div>
			<div class="empty-message">
				Try a different search term or make sure the relevant layers are active.
			</div>
		</div>
	{/if}
</div>

<style>
	.search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-top: none;
		border-radius: 0 0 12px 12px;
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		max-height: 400px;
		overflow: hidden;
		z-index: 1000;
	}

	.loading-state,
	.error-state {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 20px;
		color: #6b7280;
		font-size: 14px;
	}

	.error-state {
		color: #dc2626;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #f3f4f6;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.results-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #f3f4f6;
		background: #f9fafb;
	}

	.results-count {
		font-size: 12px;
		font-weight: 500;
		color: #6b7280;
	}

	.clear-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: none;
		border-radius: 4px;
		color: #9ca3af;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-button:hover {
		background: #f3f4f6;
		color: #6b7280;
	}

	.results-list {
		max-height: 320px;
		overflow-y: auto;
	}

	.result-item {
		width: 100%;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		background: none;
		border: none;
		border-bottom: 1px solid #f3f4f6;
		cursor: pointer;
		transition: background-color 0.2s;
		text-align: left;
	}

	.result-item:hover {
		background: #f9fafb;
	}

	.result-item:active {
		background: #f3f4f6;
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.result-icon {
		font-size: 16px;
		margin-top: 2px;
		flex-shrink: 0;
	}

	.result-content {
		flex: 1;
		min-width: 0;
	}

	.result-name {
		font-size: 14px;
		font-weight: 500;
		color: #1f2937;
		margin-bottom: 2px;
		line-height: 1.3;
	}

	.result-value {
		font-size: 13px;
		color: #6b7280;
		margin-bottom: 4px;
		line-height: 1.3;
	}

	.result-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.layer-name {
		font-size: 11px;
		font-weight: 500;
		color: #3b82f6;
		background: #eff6ff;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.service-name {
		font-size: 11px;
		color: #6b7280;
		background: #f3f4f6;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.result-action {
		color: #9ca3af;
		margin-top: 2px;
		flex-shrink: 0;
	}

	.result-item:hover .result-action {
		color: #6b7280;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
		color: #9ca3af;
	}

	.empty-state svg {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-title {
		font-size: 16px;
		font-weight: 500;
		color: #6b7280;
		margin-bottom: 8px;
	}

	.empty-message {
		font-size: 14px;
		line-height: 1.4;
		max-width: 280px;
	}

	/* Scrollbar styling */
	.results-list::-webkit-scrollbar {
		width: 4px;
	}

	.results-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.results-list::-webkit-scrollbar-thumb {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.results-list::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 0, 0, 0.3);
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* Mobile optimizations */
	@media (max-width: 480px) {
		.search-results {
			max-height: 300px;
		}

		.results-list {
			max-height: 240px;
		}

		.result-item {
			padding: 10px 12px;
			font-size: 13px;
		}

		.result-name {
			font-size: 13px;
		}

		.result-value {
			font-size: 12px;
		}

		.layer-name,
		.service-name {
			font-size: 10px;
		}

		.empty-state {
			padding: 30px 16px;
		}

		.empty-state svg {
			width: 40px;
			height: 40px;
		}
	}
</style>
