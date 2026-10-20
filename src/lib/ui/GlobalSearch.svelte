<script lang="ts">
	// Search across deals, organizations and contacts (top bar): ONE call, `GET /api/search`; when nothing is found as typed the server tries the other keyboard
	// layout (`gge` ↔ «ппу») and says so in `corrected_query` — shown above the results. Desktop: inline field + dropdown, Ctrl/⌘+K focuses it.
	// Phone: an icon that opens a full-width dialog with the same field and results. ↑ ↓ Enter Esc work everywhere.
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { ListItem } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { Search } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { debounce } from '$lib/utils/debounce';
	import AppModal from './AppModal.svelte';
	import SearchInput from './SearchInput.svelte';
	import { correctedNote, searchGroups, searchText, type SearchGroup, type SearchRow } from './global-search';

	const bp = useBreakpoint();
	let q = $state('');
	let open = $state(false);
	let dialog = $state(false);
	let loading = $state(false);
	let groups = $state<SearchGroup[]>([]);
	/** по набранному ничего нет, показаны результаты для строки в другой раскладке */
	let corrected = $state<string | null>(null);
	let active = $state(0);
	let input = $state<HTMLInputElement | null>(null);
	let root = $state<HTMLElement | null>(null);
	let ctrl: AbortController | null = null;

	const flat = $derived(groups.flatMap((g) => g.rows));
	const canSearch = $derived(session.canAny('deal:read', 'organization:read', 'contact:read'));

	async function run(raw: string) {
		ctrl?.abort();
		const text = searchText(raw);
		if (!text) {
			groups = [];
			corrected = null;
			loading = false;
			return;
		}
		const my = (ctrl = new AbortController());
		loading = true;
		try {
			const res = await unwrap(api.GET('/api/search', { params: { query: { q: text, limit: 5 } }, signal: my.signal }));
			if (my.signal.aborted) return;
			groups = searchGroups(res);
			corrected = res.corrected_query ?? null;
			active = 0;
		} catch {
			if (!my.signal.aborted) {
				groups = [];
				corrected = null;
			}
		} finally {
			if (!my.signal.aborted) loading = false;
		}
	}
	const search = debounce((text: string) => void run(text), 250);

	function change(value: string) {
		q = value;
		open = true;
		if (!searchText(value)) {
			ctrl?.abort();
			groups = [];
			corrected = null;
			loading = false;
		}
		search(value);
	}

	function pick(row: SearchRow | undefined) {
		if (!row) return;
		open = false;
		dialog = false;
		q = '';
		groups = [];
		corrected = null;
		void goto(row.href);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(active + 1, flat.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			pick(flat[active]);
		} else if (e.key === 'Escape') {
			open = false;
			dialog = false;
			input?.blur();
		}
	}

	onMount(() => {
		const shortcut = async (e: KeyboardEvent) => {
			// by the physical key: with the Russian layout `key` is «л», but `code` stays KeyK
			if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyK') {
				e.preventDefault();
				if (bp.isMobile) dialog = true;
				else input?.focus();
			}
		};
		const outside = (e: MouseEvent) => {
			if (root && !root.contains(e.target as Node)) open = false;
		};
		window.addEventListener('keydown', shortcut);
		window.addEventListener('mousedown', outside);
		return () => {
			window.removeEventListener('keydown', shortcut);
			window.removeEventListener('mousedown', outside);
			ctrl?.abort();
		};
	});

	$effect(() => {
		if (dialog) void tick().then(() => input?.focus());
	});
</script>

{#snippet field(idx: string)}
	<div class="relative w-full min-w-0" bind:this={root}>
		<SearchInput
			bind:ref={input}
			id={idx}
			size={bp.isMobile ? 'l' : 'm'}
			role="combobox"
			aria-expanded={open && q.trim().length >= 2}
			aria-controls="{idx}-list"
			aria-label="Поиск по сделкам, организациям и контактам"
			placeholder="Поиск"
			shortcut={bp.isMobile ? undefined : 'K'}
			autocomplete="off"
			value={q}
			onChange={(e: Event) => change((e.target as HTMLInputElement).value)}
			onFocus={() => (open = true)}
			onkeydown={onKey}
		/>

		{#if open && q.trim().length >= 2}
			<div
				id="{idx}-list"
				class={[
					'z-(--atmr-z-index-dropdown) overflow-y-auto rounded-lg border border-line bg-elevated shadow-l',
					bp.isMobile ? 'mt-2 max-h-[60dvh]' : 'absolute top-full right-0 left-0 mt-2 max-h-[70dvh]'
				]}
				role="listbox"
			>
				{#if loading && groups.length === 0}
					<p class="t-body-s p-4 text-muted">Ищем…</p>
				{:else if groups.length === 0}
					<p class="t-body-s p-4 text-muted">Ничего не найдено</p>
				{:else}
					{#if correctedNote(corrected)}<p class="t-desc-l m-0 border-b border-line px-4 py-2 text-muted" data-testid="search-corrected">{correctedNote(corrected)}</p>{/if}
					{#each groups as group (group.key)}
						<div class="border-b border-line py-1 last:border-b-0">
							<p class="t-desc-m px-4 pt-2 pb-1 text-soft">{group.title}</p>
							<ul class="m-0 list-none p-0">
								{#each group.rows as row (row.id)}
									{@const index = flat.indexOf(row)}
									<ListItem class="px-4 py-2" role="option" aria-selected={index === active} selected={index === active} onclick={() => pick(row)} onmouseenter={() => (active = index)}>
										<span class="flex min-w-0 items-baseline gap-3">
											<span class="t-body-s min-w-0 flex-1 truncate">{row.primary}</span>
											{#if row.secondary}<span class="t-desc-m flex-none text-muted">{row.secondary}</span>{/if}
										</span>
									</ListItem>
								{/each}
							</ul>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#if canSearch}
	{#if bp.isMobile}
		<button type="button" class="atmr-top-menu__utilities-icon" aria-label="Поиск" title="Поиск" onclick={() => (dialog = true)}><Search /></button>
		<AppModal open={dialog} title="Поиск" size="m" onClose={() => (dialog = false)}>
			{@render field('gs-m')}
		</AppModal>
	{:else}
		<div class="w-full max-w-md min-w-0">{@render field('gs-d')}</div>
	{/if}
{/if}
