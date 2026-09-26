<script lang="ts">
	// Профиль учащегося (данные шаблона LMS «Загрузка пользователей»): паспорт, СНИЛС, адрес регистрации, диплом. Это ПДн:
	// сервер отдаёт их маскированными, «Показать» раскрывает и пишет доступ в журнал. Раскрытые значения живут только на странице.
	import { onMount } from 'svelte';
	import { Edit, PasswordShow } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, toast } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import Field from '../shared/Field.svelte';
	import type { LearnerProfile, LearnerProfileReveal } from '../types';
	import LearnerProfileDrawer from './LearnerProfileDrawer.svelte';
	import { LEARNER_SECTIONS, filledFields } from './learnerProfile';

	let { contactId }: { contactId: string } = $props();

	let profile = $state<LearnerProfile | null>(null);
	let revealed = $state<LearnerProfileReveal | null>(null);
	let revealing = $state(false);
	let editing = $state(false);
	const canEdit = $derived(session.can('contact:write'));

	onMount(async () => {
		try {
			profile = await unwrap(api.GET('/api/contacts/{contact_id}/learner-profile', { params: { path: { contact_id: contactId } } }));
		} catch {
			profile = null; // нет прав или профиля — карточка просто не показывается
		}
	});

	async function reveal() {
		if (revealing) return;
		revealing = true;
		try {
			revealed = await unwrap(api.POST('/api/contacts/{contact_id}/learner-profile/reveal', { params: { path: { contact_id: contactId } } }));
			toast.info('Доступ к данным записан в журнал');
		} catch (e) {
			toast.error(e);
		} finally {
			revealing = false;
		}
	}

	const shown = $derived((revealed ?? profile) as Record<string, unknown> | null);
	const sections = $derived(shown ? LEARNER_SECTIONS.map((s) => ({ ...s, fields: filledFields(shown, s.fields) })).filter((s) => s.fields.length) : []);
</script>

{#if sections.length || canEdit}
	<Card title="Профиль учащегося">
		{#snippet action()}
			{#if canEdit}
				<Btn label={sections.length ? 'Изменить' : 'Заполнить'} icon={Edit} size="s" variant="outline" colorScheme="neutral" onclick={() => (editing = true)} data-testid="learner-edit" />
			{/if}
			{#if sections.length && !revealed && session.can('contact:reveal')}
				<Btn label="Показать" icon={PasswordShow} size="s" variant="outline" colorScheme="neutral" loading={revealing} onclick={reveal} data-testid="learner-reveal" />
			{/if}
		{/snippet}
		{#if !sections.length}<p class="t-body-m m-0 text-muted">Данные для выгрузки в LMS не заполнены.</p>{/if}
		<div class="flex flex-col gap-5">
			{#each sections as section (section.key)}
				<section class="flex flex-col gap-2" aria-label={section.title}>
					<h3 class="t-body-m-strong">{section.title}</h3>
					<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 max-md:grid-cols-1">
						{#each section.fields as f (f.key)}<Field label={f.label}>{f.value}</Field>{/each}
					</dl>
				</section>
			{/each}
		</div>
	</Card>
{/if}

<LearnerProfileDrawer
	open={editing}
	{contactId}
	{profile}
	onClose={() => (editing = false)}
	onSaved={(saved) => {
		profile = saved;
		revealed = null;
	}}
/>
