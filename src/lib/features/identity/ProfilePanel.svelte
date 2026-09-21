<script lang="ts">
	// Вкладка «Профиль»: кто я в системе (только чтение — `PATCH /me` в бэкенде нет) и оформление.
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { POLICY_TEXT } from '$lib/content/policy';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { roleLabel, userStatusMeta } from './labels';
	import ThemePicker from './ThemePicker.svelte';

	const me = $derived(session.me);
	const status = $derived(userStatusMeta(me?.status ?? ''));
	let policyOpen = $state(false);
	let teamName = $state<string | null>(null);

	onMount(() => {
		if (me?.manager_id) people.ensure([me.manager_id]);
		// названия команд читает только администратор; остальным строку «Команда» не показываем
		if (me?.team_id && session.can('user:read')) {
			void api.GET('/api/admin/teams', { params: { query: { limit: 100 } } }).then(({ data }) => {
				teamName = data?.items.find((t) => t.id === me.team_id)?.name ?? null;
			});
		}
	});

	const rows = $derived(
		me
			? [
					{ label: 'Email', value: me.email ?? '—' },
					{ label: 'Роль', value: roleLabel(me.role) },
					...(teamName ? [{ label: 'Команда', value: teamName }] : []),
					...(me.manager_id ? [{ label: 'Руководитель', value: people.name(me.manager_id) }] : []),
					{ label: 'Часовой пояс', value: me.timezone }
				]
			: []
	);
</script>

{#if me}
	<div class="flex flex-col gap-4">
		<section class="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 max-md:gap-3 max-md:p-3">
			<Avatar name={me.full_name} size={64} />
			<div class="min-w-0 flex-1">
				<h2 class="t-h3 m-0 break-words">{me.display_name || me.full_name}</h2>
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<StatusChip label={status.label} tone={status.tone} />
					<span class="t-desc-l text-muted">{roleLabel(me.role)}</span>
				</div>
			</div>
		</section>

		<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 [&_dt]:mt-1 max-md:grid-cols-1 max-md:gap-y-1">
				{#each rows as row (row.label)}
					<dt class="t-desc-l text-muted">{row.label}</dt>
					<dd class="t-body-m m-0 mb-2 break-words md:mb-0">{row.value}</dd>
				{/each}
				<dt class="t-desc-l text-muted">Последний вход</dt>
				<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={me.last_login_at} time relative /></dd>
				<dt class="t-desc-l text-muted">Согласие на ПДн</dt>
				<dd class="t-body-m m-0 flex flex-wrap items-center gap-x-3">
					<span>версия {me.consent_version ?? '—'}</span>
					<Btn label="Читать политику" variant="ghost" size="s" onclick={() => (policyOpen = true)} />
				</dd>
			</dl>
		</section>

		<section class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<h2 class="t-body-m-strong m-0">Оформление</h2>
			<ThemePicker />
		</section>
	</div>

	<AppModal open={policyOpen} title="Политика обработки персональных данных" size="l" onClose={() => (policyOpen = false)}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- the text of the policy: our own markdown, rendered through DOMPurify -->
		<div class="md">{@html renderMarkdown(POLICY_TEXT)}</div>
		{#snippet footer()}<Btn label="Закрыть" onclick={() => (policyOpen = false)} />{/snippet}
	</AppModal>
{/if}
