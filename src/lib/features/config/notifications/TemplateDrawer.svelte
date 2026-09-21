<script lang="ts">
	// Шаблон уведомления: событие и канал (при создании), тема (email), текст с подсказкой переменных, «Активен». Предпросмотра рендера у бэкенда нет.
	import { untrack } from 'svelte';
	import { Chip } from '@lct-testkit/rt-ui';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_CODES, labelOf } from '../labels';
	import type { NotificationTemplate } from '../types';
	import { FormDrawer } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	type Channel = 'email' | 'telegram' | 'in_app';

	interface Props {
		open: boolean;
		item: NotificationTemplate | null;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open, item, onClose, onSaved }: Props = $props();

	const CUSTOM = '__custom';
	let eventKey = $state<string | null>(null);
	let customCode = $state('');
	let channel = $state<string | null>('in_app');
	let subject = $state('');
	let body = $state('');
	let active = $state(true);
	let version = $state(0);
	let area = $state<HTMLTextAreaElement | null>(null);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);
	const code = $derived(eventKey === CUSTOM ? customCode.trim() : (eventKey ?? ''));
	const variables = $derived(NOTIFICATION_EVENT_CODES.find((e) => e.key === code)?.variables ?? []);
	const eventItems = $derived([
		...NOTIFICATION_EVENT_CODES.map((e) => ({ key: e.key, value: e.value, hint: e.key })),
		{ key: CUSTOM, value: 'Другой код события…' }
	]);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			const known = item && NOTIFICATION_EVENT_CODES.some((e) => e.key === item.code);
			eventKey = item ? (known ? item.code : CUSTOM) : null;
			customCode = item && !known ? item.code : '';
			channel = item?.channel ?? 'in_app';
			subject = item?.subject_template ?? '';
			body = item?.body_template ?? '';
			active = item?.is_active ?? true;
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	/** Вставляет `{{ имя }}` в позицию курсора текста (или в конец, если поле ещё не в фокусе). */
	function insert(name: string) {
		const token = `{{ ${name} }}`;
		const at = area?.selectionStart ?? body.length;
		const end = area?.selectionEnd ?? at;
		body = `${body.slice(0, at)}${token}${body.slice(end)}`;
		queueMicrotask(() => {
			area?.focus();
			area?.setSelectionRange(at + token.length, at + token.length);
		});
	}

	async function save() {
		const next: Record<string, string> = {};
		if (isNew && !code) next.code = 'Выберите событие или укажите код';
		if (!body.trim()) next.body_template = 'Введите текст уведомления';
		if (channel === 'email' && !subject.trim()) next.subject_template = 'У письма должна быть тема';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const subjectTemplate = channel === 'email' ? subject.trim() : null;
			if (item) {
				await unwrap(api.PATCH('/api/admin/notification-templates/{template_id}', { params: { path: { template_id: item.id } }, body: { subject_template: subjectTemplate, body_template: body, is_active: active }, headers: ifMatch(version) }));
				toast.success('Шаблон сохранён');
			} else {
				await unwrap(api.POST('/api/admin/notification-templates', { body: { code, channel: (channel ?? 'in_app') as Channel, subject_template: subjectTemplate, body_template: body, locale: 'ru', is_active: active }, headers: idem(idemKey) }));
				toast.success('Шаблон создан');
			}
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'channel', 'subject_template', 'body_template']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	async function reloadVersion() {
		if (!item) return;
		try {
			const res = await unwrap(api.GET('/api/admin/notification-templates', { params: { query: { code: item.code, channel: item.channel, limit: 5 } } }));
			const fresh = res.items.find((t) => t.id === item.id);
			if (fresh) {
				version = fresh.version;
				conflict = false;
				toast.info('Загружена актуальная версия', 'Проверьте текст и сохраните ещё раз');
			}
		} catch (e) {
			toast.error(e);
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новый шаблон' : (NOTIFICATION_EVENT_CODES.find((e) => e.key === item?.code)?.value ?? item?.code ?? 'Шаблон')} width={520} {saving} {formError} {conflict} saveLabel={isNew ? 'Создать' : 'Сохранить'} onSave={save} {onClose} onReload={reloadVersion}>
	{#if isNew}
		<Pick label="Событие" search bind:value={eventKey} items={eventItems} error={errors.code} />
		{#if eventKey === CUSTOM}<TextField label="Код события" bind:value={customCode} placeholder="DEAL_CUSTOM_EVENT" hint="Заглавные латинские буквы и «_»: код должен совпадать с кодом в действии перехода" />{/if}
		<Pick label="Канал" bind:value={channel} items={NOTIFICATION_CHANNELS.map((c) => ({ key: c.key, value: c.value }))} />
	{:else}
		<div class="t-desc-l flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
			<span class="font-mono">{item?.code}</span>
			<span>{labelOf(NOTIFICATION_CHANNELS, item?.channel)}</span>
		</div>
	{/if}
	{#if channel === 'email'}<TextField label="Тема письма" bind:value={subject} error={errors.subject_template} />{/if}
	<AreaField label="Текст" bind:value={body} bind:ref={area} rows={8} maxRows={16} error={errors.body_template} />
	{#if variables.length}
		<div class="flex flex-col gap-1.5">
			<span class="t-desc-l text-muted">Переменные — нажмите, чтобы вставить</span>
			<div class="flex flex-wrap gap-1.5">
				{#each variables as v (v)}
					<Chip size="s" variant="secondary" selected={false} class="font-mono" label={`{{ ${v} }}`} onclick={() => insert(v)} />
				{/each}
			</div>
		</div>
	{/if}
	<Toggle label="Активен" bind:checked={active} />
</FormDrawer>
