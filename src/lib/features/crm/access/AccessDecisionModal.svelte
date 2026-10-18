<script lang="ts">
	// Решение по запросу доступа: одобрить на N дней (по умолчанию 30) или отклонить с обязательным комментарием.
	import { api, errorMessage, unwrap } from '$lib/api';
	import { AreaField, FormModal, NumberField, UserName, toast } from '$lib/ui';
	import type { AccessRequest } from '../types';
	import { DEFAULT_ACCESS_DAYS, MAX_ACCESS_DAYS, validateDays } from './accessRequests';

	interface Props {
		open: boolean;
		request: AccessRequest | null;
		mode: 'approve' | 'reject';
		onClose: () => void;
		onDone: (request: AccessRequest) => void;
	}

	let { open, request, mode, onClose, onDone }: Props = $props();

	let days = $state<number | null>(DEFAULT_ACCESS_DAYS);
	let comment = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let errors = $state<{ days?: string; comment?: string }>({});

	$effect(() => {
		if (open) {
			days = DEFAULT_ACCESS_DAYS;
			comment = '';
			error = null;
			errors = {};
		}
	});

	async function submit() {
		if (busy || !request) return;
		const next: { days?: string; comment?: string } = {};
		if (mode === 'approve') {
			const bad = validateDays(days);
			if (bad) next.days = bad;
		} else if (!comment.trim()) next.comment = 'Объясните причину отказа';
		errors = next;
		if (Object.keys(next).length) return;
		busy = true;
		error = null;
		try {
			const body = mode === 'approve' ? { decision: 'approve' as const, days, comment: comment.trim() || null } : { decision: 'reject' as const, comment: comment.trim() };
			const done = await unwrap(api.POST('/api/access-requests/{request_id}/decision', { params: { path: { request_id: request.id } }, body }));
			toast.success(mode === 'approve' ? 'Доступ выдан' : 'Запрос отклонён');
			onDone(done);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} size="s" title={mode === 'approve' ? 'Одобрить доступ' : 'Отклонить запрос'} saveLabel={mode === 'approve' ? 'Одобрить' : 'Отклонить'} danger={mode === 'reject'} saving={busy} dirty={open && (!!comment.trim() || days !== DEFAULT_ACCESS_DAYS)} formError={error} onSave={submit} {onClose}>
	{#if request}
		<p class="t-body-m m-0 text-muted">Просит <span class="text-fg"><UserName id={request.requester_id} /></span>: «{request.reason}»</p>
	{/if}
	{#if mode === 'approve'}
		<NumberField label="Срок доступа, дней" required integer min={1} max={MAX_ACCESS_DAYS} value={days} error={errors.days} onChange={(v) => ((days = v), (errors = { ...errors, days: undefined }))} onEnter={submit} />
	{/if}
	<AreaField label={mode === 'approve' ? 'Комментарий' : 'Причина отказа'} required={mode === 'reject'} rows={2} maxlength={1000} value={comment} error={errors.comment} onInput={(v) => ((comment = v), (errors = { ...errors, comment: undefined }))} onSubmit={submit} />
</FormModal>
