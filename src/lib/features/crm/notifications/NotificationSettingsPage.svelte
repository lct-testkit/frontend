<script lang="ts">
	// Настройки уведомлений: по каждому событию — включено ли и по каким каналам; общие «тихие часы». Одна кнопка «Сохранить» (PUT списком).
	// Список настраиваемых кодов — с бэкенда (`GET /notifications/event-codes`: коды с активным шаблоном, любой аутентифицированный);
	// код из уже сохранённых настроек, которого в этом списке больше нет, всё равно показываем — иначе включённая правка исчезла бы молча.
	// Русские подписи и группы — из eventCodes.ts (бэкенд отдаёт только код, не текст).
	import { onMount } from 'svelte';
	import { Checkbox, Switch } from '@lct-testkit/rt-ui';
	import { api, unwrap } from '$lib/api';
	import { Btn, ErrorState, Notice, Page, PageHeader, Skeleton, toast } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { NOTIFICATION_CHANNEL_LABELS } from '../shared/labels';
	import type { NotificationPref } from '../types';
	import { EVENT_GROUP_LABELS, eventCodeInfo, type EventCodeInfo, type EventGroup } from './eventCodes';

	type Channel = 'in_app' | 'email' | 'telegram';
	interface Row {
		code: string;
		enabled: boolean;
		channels: Channel[];
	}

	const CHANNELS: Channel[] = ['in_app', 'email', 'telegram'];
	const DEFAULT: Omit<Row, 'code'> = { enabled: true, channels: ['in_app'] };

	let rows = $state<Row[]>([]);
	let from = $state<string | null>(null);
	let to = $state<string | null>(null);
	let snapshot = '';
	let loading = $state(true);
	let error = $state<unknown>(null);
	let saving = $state(false);

	const hours = Array.from({ length: 24 }, (_, h) => ({ key: `${String(h).padStart(2, '0')}:00:00`, value: `${String(h).padStart(2, '0')}:00` }));
	const hhmmss = (t: string | null | undefined): string | null => (t ? t.slice(0, 5) + ':00' : null);

	const signature = () => JSON.stringify([rows, from, to]);
	const dirty = $derived(!loading && signature() !== snapshot);

	async function load() {
		loading = true;
		error = null;
		try {
			const [prefsRes, codesRes] = await Promise.all([unwrap(api.GET('/api/me/notification-prefs')), unwrap(api.GET('/api/notifications/event-codes'))]);
			const saved = new Map(prefsRes.items.map((p: NotificationPref) => [p.event_code, p]));
			const known = new Set(codesRes.items.map((e) => e.code));
			const codes = [...codesRes.items.map((e) => e.code), ...[...saved.keys()].filter((c) => !known.has(c))];
			rows = codes.map((code) => {
				const p = saved.get(code);
				return p ? { code, enabled: p.is_enabled, channels: p.channels as Channel[] } : { code, ...DEFAULT, channels: [...DEFAULT.channels] };
			});
			const any = [...saved.values()].find((p) => p.quiet_hours_start || p.quiet_hours_end);
			from = hhmmss(any?.quiet_hours_start);
			to = hhmmss(any?.quiet_hours_end);
			snapshot = signature();
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function save() {
		saving = true;
		try {
			await unwrap(
				api.PUT('/api/me/notification-prefs', {
					body: { prefs: rows.map((r) => ({ event_code: r.code, is_enabled: r.enabled, channels: r.channels, quiet_hours_start: from, quiet_hours_end: to })) }
				})
			);
			snapshot = signature();
			toast.success('Настройки сохранены');
		} catch (e) {
			toast.error(e);
		} finally {
			saving = false;
		}
	}

	const groups = $derived.by(() => {
		const map = new Map<EventGroup, { info: EventCodeInfo; row: Row }[]>();
		for (const row of rows) {
			const info = eventCodeInfo(row.code);
			map.set(info.group, [...(map.get(info.group) ?? []), { info, row }]);
		}
		return (['deals', 'organizations', 'signing', 'account', 'other'] as EventGroup[]).filter((g) => map.has(g)).map((g) => ({ group: g, list: map.get(g)! }));
	});

	function toggleChannel(row: Row, channel: Channel, on: boolean) {
		row.channels = on ? [...new Set([...row.channels, channel])] : row.channels.filter((c) => c !== channel);
	}
</script>

<svelte:head><title>Настройки уведомлений · RTK School</title></svelte:head>

<Page narrow class="pb-24">
	<PageHeader title="Настройки уведомлений" back="/notifications" />

	{#if loading}
		<Skeleton kind="rows" rows={6} />
	{:else if error}
		<ErrorState {error} onRetry={load} />
	{:else}
		<Notice class="shrink-0" tone="info">Событие — то, что происходит в системе, например смена статуса сделки. Переключатель «Получать» включает или выключает все уведомления об этом событии, флажки выбирают каналы доставки.</Notice>

		<Card title="Тихие часы">
			<div class="grid max-w-xl grid-cols-2 gap-3 max-md:grid-cols-1">
				<Pick label="Не беспокоить с" items={hours} clearable value={from} placeholder="Всегда" onChange={(v) => (from = v)} />
				<Pick label="до" items={hours} clearable value={to} placeholder="Всегда" onChange={(v) => (to = v)} />
			</div>
		</Card>

		{#each groups as g (g.group)}
			<Card title={EVENT_GROUP_LABELS[g.group]} flush>
				<ul class="m-0 list-none p-0">
					{#each g.list as { info, row } (row.code)}
						<li class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
							<span class="t-body-m min-w-0 flex-1 basis-56 max-md:order-1">{info.label}</span>
							<span class="flex flex-wrap items-center gap-x-4 gap-y-1 max-md:order-3 max-md:basis-full">
								{#each CHANNELS as channel (channel)}
									<Checkbox
										variant="primary"
										label={NOTIFICATION_CHANNEL_LABELS[channel]}
										checked={row.channels.includes(channel)}
										disabled={!row.enabled}
										onChange={(v: boolean) => toggleChannel(row, channel, v)}
									/>
								{/each}
							</span>
							<span class="max-md:order-2" title={info.locked ? 'Уведомление о безопасности нельзя отключить' : undefined}>
								<Switch checked={row.enabled} disabled={info.locked} label="Получать" aria-label={info.label} onChange={(v: boolean) => (row.enabled = v)} />
							</span>
						</li>
					{/each}
				</ul>
			</Card>
		{/each}

		<!-- the MAIN button first, on the left (as in every form); on a phone the bar is a row with the main button on the right, at the thumb -->
		<div class="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-m max-md:flex-row-reverse max-md:[&>*]:flex-1">
			<Btn label="Сохранить" size="auto" loading={saving} disabled={!dirty} onclick={save} data-testid="prefs-save" />
			<Btn label="Сбросить" size="auto" variant="outline" colorScheme="neutral" disabled={!dirty || saving} onclick={load} />
		</div>
	{/if}
</Page>
