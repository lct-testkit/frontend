<script lang="ts">
	// Подписка на исходящие события: название, адрес, события, фильтры по содержимому. У существующей — ещё секрет (смена, показывается один раз), тестовая отправка,
	// журнал доставок и «Как принять» (заголовки, подпись, примеры проверки, правила повторов). Секрет при создании приходит в `onCreated` и показывается снаружи.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { getConfig } from '$lib/config';
	import { Btn, CopyButton, FormDrawer, FormSection, Notice, confirm, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import type { WebhookSubscription } from '../types';
	import {
		RECEIVE_EXAMPLE,
		RECEIVE_HEADERS,
		RECEIVE_NODE,
		RECEIVE_PYTHON,
		RECEIVE_RULES,
		WEBHOOK_EVENTS,
		disabledReasonText,
		parseFilters,
		pingText,
		validateSubscription,
		type PingResult
	} from './subscriptions';

	interface Props {
		open: boolean;
		subscription: WebhookSubscription | null;
		onClose: () => void;
		onSaved: (saved: WebhookSubscription) => void;
		onCreated: (created: WebhookSubscription, secret: string) => void;
		onRotated: (saved: WebhookSubscription, secret: string) => void;
		onDeleted: (id: string) => void;
		onDeliveries: (s: WebhookSubscription) => void;
	}

	let { open, subscription, onClose, onSaved, onCreated, onRotated, onDeleted, onDeliveries }: Props = $props();

	let name = $state('');
	let url = $state('');
	let events = $state<string[]>([]);
	let filtersText = $state('');
	let isActive = $state(true);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let pinging = $state(false);
	let ping = $state<PingResult | null>(null);
	let rotating = $state(false);
	let deleting = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(subscription === null);
	const prod = $derived(getConfig().mode === 'prod');
	const reason = $derived(disabledReasonText(subscription?.disabled_reason));
	/** события подписки, которых нет в каталоге интерфейса (показываем как есть, чтобы не потерять при сохранении) */
	const extraEvents = $derived(events.filter((e) => !WEBHOOK_EVENTS.some((k) => k.key === e)));

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = subscription?.name ?? '';
			url = subscription?.url ?? '';
			events = [...(subscription?.event_types ?? [])];
			const f = subscription?.filters ?? {};
			filtersText = Object.keys(f).length ? JSON.stringify(f, null, 2) : '';
			isActive = subscription?.is_active ?? true;
			errors = {};
			formError = null;
			ping = null;
			idemKey = crypto.randomUUID();
		});
	});

	const toggleEvent = (key: string, on: boolean) => (events = on ? [...events, key] : events.filter((e) => e !== key));

	async function save() {
		const next = validateSubscription({ name, url, events, filtersText }, { prod });
		errors = next;
		if (Object.keys(next).length) return;
		const filters = parseFilters(filtersText).value ?? {};
		saving = true;
		formError = null;
		try {
			if (subscription) {
				const saved = await unwrap(
					api.PATCH('/api/admin/integrations/webhooks/{subscription_id}', {
						params: { path: { subscription_id: subscription.id } },
						body: { name: name.trim(), url: url.trim(), event_types: events, filters, is_active: isActive }
					})
				);
				toast.success('Подписка сохранена');
				onSaved(saved);
			} else {
				const created = await unwrap(api.POST('/api/admin/integrations/webhooks', { body: { name: name.trim(), url: url.trim(), event_types: events, filters }, headers: { 'Idempotency-Key': idemKey } }));
				const { secret, ...saved } = created;
				onCreated(saved, secret);
			}
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['name', 'url', 'event_types', 'filters']);
			errors = { ...failure.fields, ...(failure.fields.event_types ? { events: failure.fields.event_types } : {}) };
			formError = failure.form;
		} finally {
			saving = false;
		}
	}

	async function sendPing() {
		if (!subscription || pinging) return;
		pinging = true;
		ping = null;
		try {
			ping = pingText(await unwrap(api.POST('/api/admin/integrations/webhooks/{subscription_id}/test', { params: { path: { subscription_id: subscription.id } } })));
		} catch (e) {
			toast.error(e);
		} finally {
			pinging = false;
		}
	}

	async function rotate() {
		if (!subscription || rotating) return;
		if (!(await confirm({ title: 'Сменить секрет подписи?', message: 'Прежний секрет перестанет действовать сразу: получатель должен получить новый, иначе подпись перестанет сходиться.', confirmLabel: 'Сменить', danger: true }))) return;
		rotating = true;
		try {
			const { secret, ...saved } = await unwrap(api.POST('/api/admin/integrations/webhooks/{subscription_id}/rotate-secret', { params: { path: { subscription_id: subscription.id } } }));
			onRotated(saved, secret);
			onClose();
		} catch (e) {
			toast.error(e);
		} finally {
			rotating = false;
		}
	}

	async function remove() {
		if (!subscription || deleting) return;
		if (!(await confirm({ title: `Удалить подписку «${subscription.name}»?`, message: 'Вместе с подпиской удалится вся её очередь доставки, новые события отправляться не будут.', confirmLabel: 'Удалить', danger: true }))) return;
		deleting = true;
		try {
			await unwrap(api.DELETE('/api/admin/integrations/webhooks/{subscription_id}', { params: { path: { subscription_id: subscription.id } } }));
			toast.success('Подписка удалена');
			onDeleted(subscription.id);
			onClose();
		} catch (e) {
			toast.error(e);
		} finally {
			deleting = false;
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новая подписка' : name || 'Подписка'} width={560} {saving} {formError} saveLabel={isNew ? 'Создать' : 'Сохранить'} onSave={save} {onClose}>
	{#snippet extra()}
		{#if subscription}<Btn label="Удалить" variant="ghost" colorScheme="neutral" danger loading={deleting} onclick={remove} data-testid="sub-delete" />{/if}
	{/snippet}

	{#if reason}<Notice class="shrink-0" tone="warning">{reason}. Исправьте причину и включите подписку снова.</Notice>{/if}
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus />
	<TextField label="Адрес" required bind:value={url} error={errors.url} placeholder="https://…" hint={prod ? 'Только https; адреса внутренней сети сервер не принимает' : 'В боевом режиме сервер не принимает адреса внутренней сети'} />

	<fieldset class="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
		<legend class="t-body-s-strong mb-2 p-0"><span class="field-required">События</span></legend>
		{#each WEBHOOK_EVENTS as e (e.key)}
			<CheckField label={e.value} checked={events.includes(e.key)} onChange={(v) => toggleEvent(e.key, v)} />
		{/each}
		{#each extraEvents as code (code)}
			<CheckField label={code} checked onChange={(v) => toggleEvent(code, v)} />
		{/each}
		{#if errors.events}<p class="t-desc-m m-0 text-danger" role="alert">{errors.events}</p>{/if}
	</fieldset>

	{#if subscription}<Toggle label="Подписка активна" bind:checked={isActive} hint="Включение выключенной подписки сбрасывает счётчик неудач" />{/if}

	<FormSection collapsible title="Отбор событий по содержимому" open={filtersText.trim() !== ''} summary={filtersText.trim() ? 'заданы' : 'не заданы'}>
		<AreaField label="Фильтры (JSON)" bind:value={filtersText} error={errors.filters} rows={3} maxRows={8} placeholder={'{ "deal_type": "b2c" }'} hint="Подписка получает событие, только если поле нагрузки равно значению. Пусто — любое событие из списка выше" />
	</FormSection>

	{#if subscription}
		<FormSection title="Секрет подписи">
			<p class="t-desc-l m-0 text-muted">Секрет показывается один раз при создании. Если он потерян, выпустите новый: прежний перестанет действовать сразу.</p>
			<Btn label="Сменить секрет" variant="outline" colorScheme="neutral" size="auto" class="self-start max-md:w-full" loading={rotating} onclick={rotate} data-testid="sub-rotate" />
		</FormSection>

		<FormSection title="Проверка">
			<div class="flex flex-wrap items-center gap-2 max-md:flex-col max-md:items-stretch">
				<Btn label="Отправить тестовое событие" variant="outline" colorScheme="neutral" size="auto" loading={pinging} onclick={sendPing} data-testid="sub-ping" />
				<Btn label="Журнал доставок" variant="ghost" colorScheme="neutral" size="auto" onclick={() => subscription && onDeliveries(subscription)} data-testid="sub-deliveries" />
			</div>
			{#if ping}<Notice class="shrink-0" tone={ping.ok ? 'success' : 'error'} data-testid="sub-ping-result">{ping.text}</Notice>{/if}
			<p class="t-desc-m m-0 text-soft">Тестовое событие PING подписано так же, как настоящее, уходит сразу и не попадает в журнал доставок.</p>
		</FormSection>
	{/if}

	<FormSection collapsible title="Как принять события">
		<div class="flex min-w-0 flex-col gap-3">
			<div class="flex flex-col gap-1">
				<span class="t-desc-l text-muted">Заголовки запроса (POST)</span>
				<ul class="t-desc-l m-0 flex list-none flex-col gap-0.5 p-0 font-mono break-all">
					{#each RECEIVE_HEADERS as h (h)}<li>{h}</li>{/each}
				</ul>
			</div>
			<div class="flex flex-col gap-1">
				<span class="t-desc-l flex items-center justify-between text-muted">Тело запроса <CopyButton value={RECEIVE_EXAMPLE} label="Скопировать пример" /></span>
				<pre class="t-desc-m m-0 overflow-x-auto rounded-sm bg-surface-2 p-2 font-mono whitespace-pre">{RECEIVE_EXAMPLE}</pre>
			</div>
			<div class="flex flex-col gap-1">
				<span class="t-desc-l flex items-center justify-between text-muted">Проверка подписи, Python <CopyButton value={RECEIVE_PYTHON} label="Скопировать код на Python" /></span>
				<pre class="t-desc-m m-0 overflow-x-auto rounded-sm bg-surface-2 p-2 font-mono whitespace-pre">{RECEIVE_PYTHON}</pre>
			</div>
			<div class="flex flex-col gap-1">
				<span class="t-desc-l flex items-center justify-between text-muted">Проверка подписи, Node.js <CopyButton value={RECEIVE_NODE} label="Скопировать код на Node.js" /></span>
				<pre class="t-desc-m m-0 overflow-x-auto rounded-sm bg-surface-2 p-2 font-mono whitespace-pre">{RECEIVE_NODE}</pre>
			</div>
			<ul class="t-desc-l m-0 flex list-disc flex-col gap-1 pl-5 text-muted">
				{#each RECEIVE_RULES as rule (rule)}<li>{rule}</li>{/each}
			</ul>
		</div>
	</FormSection>
</FormDrawer>
