<script lang="ts">
	// Поле «ИНН или название» с автоподстановкой из реестра ЕГРЮЛ (dop.md §11.5): ввод → подсказки → выбор → `onPick`.
	// Ликвидированные показываются, но красным.
	import { Input } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { Search } from '@lct-testkit/rt-ui/icons';
	import { errorMessage } from '$lib/api';
	import { Skeleton, toast } from '$lib/ui';
	import { REGISTRY_STATUS_LABELS } from '../shared/labels';
	import { OrgLookupState, type LookupHit, type OrgLookupEntry } from './lookupState.svelte';

	interface Props {
		onPick?: (entry: OrgLookupEntry) => void;
		lookup?: OrgLookupState;
		autofocus?: boolean;
		label?: string;
	}

	let { onPick, lookup: external, autofocus = false, label = 'ИНН или название' }: Props = $props();

	// svelte-ignore state_referenced_locally
	const lookup = external ?? new OrgLookupState();
	const bp = useBreakpoint();
	let picking = $state<string | null>(null);

	async function choose(hit: LookupHit) {
		picking = hit.inn;
		try {
			const entry = await lookup.pick(hit);
			lookup.hits = [];
			lookup.message = null;
			lookup.query = hit.inn;
			onPick?.(entry);
		} catch (e) {
			toast.error(errorMessage(e));
		} finally {
			picking = null;
		}
	}
</script>

{#snippet lead()}<Search />{/snippet}

<div class="flex min-w-0 flex-col gap-2">
	<Input
		class="w-full"
		size={bp.isMobile ? 'l' : 'm'}
		{label}
		{autofocus}
		clearable
		iconPrefix={lead}
		placeholder="Например, 1655012340 или «политехнический»"
		value={lookup.query}
		inputmode="search"
		error={lookup.message?.tone === 'error' ? lookup.message.text : undefined}
		hintPrefix={lookup.message?.tone === 'info' ? lookup.message.text : undefined}
		onChange={(e: Event) => lookup.input((e.target as HTMLInputElement).value)}
		onClear={() => lookup.clear()}
	/>

	{#if lookup.loading && !lookup.hits.length}
		<Skeleton kind="rows" rows={2} />
	{:else if lookup.hits.length}
		<!-- результаты реестра: строка-кнопка с названием, ИНН, регионом и статусом в несколько строк; выбор подгружает карточку — под это в rt-ui нет готового пункта списка -->
		<ul class="m-0 flex max-h-72 list-none flex-col overflow-y-auto rounded-md border border-line bg-surface p-1" aria-label="Найдено в реестре">
			{#each lookup.hits as hit (hit.inn)}
				<li>
					<button
						type="button"
						class="flex min-h-11 w-full cursor-pointer flex-col items-start gap-0.5 rounded-sm border-0 bg-transparent px-3 py-2 text-left text-fg transition hover:bg-surface-3 disabled:cursor-default disabled:opacity-60"
						disabled={picking !== null}
						onclick={() => choose(hit)}
					>
						<span class="t-body-m-strong break-words">{hit.name}</span>
						<span class="t-desc-l flex flex-wrap gap-x-3 text-muted">
							<span>ИНН {hit.inn}</span>
							{#if hit.region}<span>{hit.region}</span>{/if}
							{#if hit.status !== 'active'}
								<span class={hit.liquidated ? 'text-danger' : 'text-warning'}>{REGISTRY_STATUS_LABELS[hit.status] ?? hit.status}</span>
							{/if}
							{#if hit.provider === 'internal_cache'}<span>уже в системе</span>{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
