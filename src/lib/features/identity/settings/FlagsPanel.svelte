<script lang="ts">
	// Feature flags: on/off is immediate (PATCH), rollout % is saved shortly after the last change (the stepper fires on every click).
	import { onMount } from 'svelte';
	import { InputNumberStepper, Switch } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { api, unwrap, type components } from '$lib/api';
	import { DateText, EmptyState, ErrorState, Skeleton, toast } from '$lib/ui';
	import FlagDrawer from './FlagDrawer.svelte';

	type Flag = components['schemas']['FeatureFlagOut'];

	// «Новый флаг» нажимают в шапке страницы, поэтому окно создания открывает родитель
	let { createOpen = $bindable(false) }: { createOpen?: boolean } = $props();

	const bp = useBreakpoint();

	let flags = $state<Flag[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let busy = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			flags = (await unwrap(api.GET('/api/admin/feature-flags', { params: { query: { limit: 100 } } }))).items;
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function patch(flag: Flag, body: { is_enabled?: boolean; rollout?: number }) {
		busy = flag.code;
		try {
			const next = await unwrap(api.PATCH('/api/admin/feature-flags/{code}', { params: { path: { code: flag.code } }, body }));
			flags = flags.map((f) => (f.code === next.code ? next : f));
			toast.success(body.is_enabled === undefined ? 'Доля обновлена' : next.is_enabled ? 'Флаг включён' : 'Флаг выключен');
		} catch (e) {
			toast.error(e);
			await load();
		} finally {
			busy = null;
		}
	}

	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	function rollout(flag: Flag, value: number) {
		const n = Math.min(100, Math.max(0, Math.round(value)));
		clearTimeout(timers.get(flag.code));
		timers.set(
			flag.code,
			setTimeout(() => {
				timers.delete(flag.code);
				if (Number.isFinite(n) && n !== flags.find((f) => f.code === flag.code)?.rollout) void patch(flag, { rollout: n });
			}, 600)
		);
	}
</script>

<FlagDrawer open={createOpen} onClose={() => (createOpen = false)} onCreated={(flag) => (flags = [flag, ...flags])} />

{#if loading}
	<Skeleton kind="list" rows={4} />
{:else if error}
	<ErrorState {error} onRetry={load} />
{:else if flags.length === 0}
	<EmptyState title="Флагов нет" compact />
{:else}
	<ul class="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line bg-surface p-0">
		{#each flags as flag (flag.code)}
			<li class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
				<div class="flex min-w-48 flex-1 flex-col">
					<span class="t-body-m-strong font-mono">{flag.code}</span>
					{#if flag.description}<span class="t-desc-l text-muted">{flag.description}</span>{/if}
				</div>
				<span class="t-desc-l flex items-center gap-2 text-muted" title="Доля пользователей, для которых флаг включён">
					<InputNumberStepper size={bp.isMobile ? 'l' : 'm'} min={0} max={100} step={10} value={flag.rollout} disabled={!flag.is_enabled || busy === flag.code ? 'all' : undefined} aria-label="Доля, %" onChange={(v: number) => rollout(flag, v)} />
					%
				</span>
				<span class="t-desc-m w-24 flex-none text-right text-soft max-md:hidden"><DateText value={flag.updated_at} relative /></span>
				<Switch checked={flag.is_enabled} disabled={busy === flag.code} aria-label="Включить {flag.code}" onChange={(v: boolean) => patch(flag, { is_enabled: v })} />
			</li>
		{/each}
	</ul>
{/if}
