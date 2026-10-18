<script lang="ts">
	// Вкладка «История»: слева таймлайн статусов (откуда, куда, кто, сколько пробыла в прошлом статусе, SLA в момент смены),
	// справа лента событий (создание, смена ответственного, подпись, перенос при изменении воронки).
	import { Badge } from '@lct-testkit/rt-ui';
	import { ArrowRight, Download } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, EmptyState, ErrorState, IconBtn, Skeleton } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import Card from '$lib/ui/Card.svelte';
	import Ico from '../../shared/Ico.svelte';
	import { formatDurationLong, parseIsoDuration } from '../../shared/duration';
	import { DEAL_EVENT_LABELS, HISTORY_REASON_LABELS, SLA_STATE_LABELS } from '../../shared/labels';
	import { downloadFile } from '../../files/download';
	import { fileKind } from '../../files/file-kind';
	import { ATTACHMENT_CATEGORY_LABELS } from '../../shared/labels';
	import type { Attachment, DealEvent, DealHistory } from '../../types';
	import { attachmentName, fileEventSummary, hideDuplicatedEvents, sortFiles } from './dealHistoryFiles';
	import DealStatusChip from '../DealStatusChip.svelte';

	// История приходит из состояния карточки (её же берёт лента шагов): один запрос на обе.
	let { dealId, data, loading, error, onRetry }: { dealId: string; data: DealHistory | null; loading: boolean; error: unknown; onRetry: () => void } = $props();

	/** файлы по записям истории (ручка требует право на скачивание: без него видно только число файлов) */
	let filesByChange = $state<Record<string, Attachment[]>>({});
	const canDownload = $derived(session.can('file:download'));

	/** файлы записей, у которых они есть: не больше 6 запросов одновременно */
	async function loadFiles(statuses: DealHistory['statuses']) {
		const withFiles = statuses.filter((s) => s.attachments_count > 0);
		const result: Record<string, Attachment[]> = {};
		let next = 0;
		const worker = async () => {
			while (next < withFiles.length) {
				const change = withFiles[next++];
				try {
					const { items } = await unwrap(api.GET('/api/deals/{deal_id}/history/{history_id}/attachments', { params: { path: { deal_id: dealId, history_id: change.id } } }));
					result[change.id] = sortFiles(items);
				} catch {
					// список файлов записи не загрузился: остаётся число файлов, событие «Добавлен файл» в ленте не скрывается
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(6, withFiles.length) }, worker));
		filesByChange = result;
	}

	$effect(() => {
		const history = data;
		if (!history) return;
		people.ensure([...history.statuses.map((s) => s.changed_by), ...history.events.map((e) => e.actor_id)]);
		if (canDownload) void loadFiles(history.statuses).then(() => people.ensure(Object.values(filesByChange).flat().map((a) => a.uploaded_by)));
	});

	const statuses = $derived([...(data?.statuses ?? [])].sort((a, b) => b.changed_at.localeCompare(a.changed_at)));
	const shownFileIds = $derived(new Set(Object.values(filesByChange).flatMap((list) => list.map((a) => a.id))));
	const events = $derived(hideDuplicatedEvents([...(data?.events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)), shownFileIds));

	const who = (payload: Record<string, unknown> | null | undefined, key: string): string => {
		const id = payload?.[key];
		return typeof id === 'string' ? people.name(id) : '—';
	};

	function summary(event: DealEvent): string {
		const p = event.payload ?? {};
		switch (event.event_type) {
			case 'OWNER_CHANGED':
				return `${who(p, 'old_owner_id')} → ${who(p, 'new_owner_id')}${typeof p.reason === 'string' && p.reason ? `. ${p.reason}` : ''}`;
			case 'FILE_ADDED':
			case 'FILE_REMOVED':
				return fileEventSummary(event);
			case 'WORKFLOW_MIGRATION':
				return p.used_fallback ? 'Сделка перенесена в запасной статус' : 'Сделка перенесена в другой статус';
			default:
				return '';
		}
	}
</script>

{#if loading && !data}
	<Skeleton kind="rows" rows={5} />
{:else if error && !data}
	<ErrorState {error} {onRetry} compact />
{:else}
	<div class="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4 max-lg:grid-cols-1">
		<Card title="Статусы">
			{#if statuses.length === 0}
				<EmptyState title="Смен статуса не было" compact />
			{:else}
				<ol class="m-0 flex list-none flex-col gap-0 p-0" data-testid="status-timeline">
					{#each statuses as change (change.id)}
						{@const spent = parseIsoDuration(change.duration_in_prev)}
						<li class="relative flex flex-col gap-1 border-l-2 border-line pb-4 pl-4 last:border-l-transparent last:pb-0">
							<span class="absolute top-1.5 -left-[5px] size-2 rounded-full bg-accent" aria-hidden="true"></span>
							<!-- «откуда → куда» в одну строку (на телефоне — столбиком): названия шагов длинные, каждый чип сжимается с многоточием, полное название — в подсказке чипа -->
							<div class="flex min-w-0 items-center gap-2 max-md:flex-col max-md:items-start max-md:gap-1">
								{#if change.from_status_id}
									<span class="flex max-w-full min-w-0 shrink"><DealStatusChip statusId={change.from_status_id} /></span>
									<Ico icon={ArrowRight} tone="soft" size={16} class="flex-none max-md:rotate-90" />
								{/if}
								<span class="flex max-w-full min-w-0 shrink"><DealStatusChip statusId={change.to_status_id} /></span>
							</div>
							<span class="t-desc-l flex flex-wrap gap-x-3 text-muted">
								<DateText value={change.changed_at} time />
								<span>{people.name(change.changed_by, 'Система')}</span>
								{#if change.reason !== 'manual'}<span>{HISTORY_REASON_LABELS[change.reason] ?? change.reason}</span>{/if}
								{#if spent !== null && change.from_status_id}<span>в прошлом статусе: {formatDurationLong(spent)}</span>{/if}
								{#if change.sla_state_at_change === 'warning' || change.sla_state_at_change === 'breached'}
									<span class={change.sla_state_at_change === 'breached' ? 'text-danger' : 'text-warning'}>SLA: {SLA_STATE_LABELS[change.sla_state_at_change]}</span>
								{/if}
							</span>
							{#if change.comment}<p class="t-body-m m-0 rounded-sm bg-surface-3 px-3 py-2 break-words">{change.comment}</p>{/if}
							{#if change.attachments_count > 0}
								{@const files = filesByChange[change.id]}
								{#if files?.length}
									<ul class="m-0 flex list-none flex-col gap-1 p-0" data-testid="history-files" aria-label="Файлы этого перехода">
										{#each files as file (file.id)}
											<li class="flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
												<span class="t-desc-l flex-none text-muted">{fileKind(file.file?.mime_type, file.file?.original_filename)}</span>
												<span class="t-body-m min-w-0 flex-1 truncate" title={attachmentName(file)}>{attachmentName(file)}</span>
												{#if file.file}<span class="t-desc-l flex-none text-muted max-md:hidden">{formatBytes(file.file.size_bytes)}</span>{/if}
												<Badge label={ATTACHMENT_CATEGORY_LABELS[file.category] ?? file.category} size="s" variant="secondary" colorScheme="neutral" class="flex-none" />
												<IconBtn icon={Download} label="Скачать" size="s" onclick={() => downloadFile(file.file_id, 'deal', dealId)} />
											</li>
										{/each}
									</ul>
								{:else}
									<span class="t-desc-l text-muted">Приложено файлов: {change.attachments_count}</span>
								{/if}
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</Card>

		<Card title="События">
			{#if events.length === 0}
				<EmptyState title="Событий нет" compact />
			{:else}
				<ul class="m-0 flex list-none flex-col gap-3 p-0">
					{#each events as event (event.id)}
						<li class="flex flex-col gap-0.5">
							<span class="t-body-m-strong">{DEAL_EVENT_LABELS[event.event_type] ?? event.event_type}</span>
							{#if summary(event)}<span class="t-body-m break-words">{summary(event)}</span>{/if}
							<span class="t-desc-l flex flex-wrap gap-x-3 text-muted"><DateText value={event.created_at} time /><span>{people.name(event.actor_id, 'Система')}</span></span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>
	</div>
{/if}
