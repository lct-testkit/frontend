<script lang="ts">
	// Запрос на удаление/обезличивание ПДн субъекта (сотрудник, контакт, ИП): режим, причина, основание.
	// Проходит через «четыре глаза» — тогда сервер отвечает CRM-1902 и заявку подтверждает второй администратор.
	import { Chip } from '@lct-testkit/rt-ui';
	import { ApiError, api, unwrap } from '$lib/api';
	import { AreaField, FormModal, RadioField, TextField } from '$lib/ui';
	import { approvalIdFromError } from '../approvals';
	import { LEGAL_BASIS_PRESETS } from '../erasure';
	import type { ErasureMode, ErasureSubjectType } from '../types';

	interface Props {
		open: boolean;
		subject: { type: ErasureSubjectType; id: string; name: string };
		approvalId?: string | null;
		presetMode?: ErasureMode;
		onClose: () => void;
		onCreated: (requestId: string) => void;
		onPending: (approvalId: string | null) => void;
	}

	let { open, subject, approvalId = null, presetMode = 'anonymize', onClose, onCreated, onPending }: Props = $props();

	let mode = $state<ErasureMode>('anonymize');
	let reason = $state('');
	let basis = $state('');
	let comment = $state('');
	let busy = $state(false);
	let errors = $state<Record<string, string>>({});

	$effect(() => {
		if (!open) return;
		mode = presetMode;
		reason = basis = comment = '';
		errors = {};
		busy = false;
	});

	const MODES = [
		{ key: 'anonymize', label: 'Обезличить' },
		{ key: 'hard_delete', label: 'Удалить полностью' }
	];

	async function submit() {
		const next: Record<string, string> = {};
		if (reason.trim().length < 3) next.reason = 'Опишите причину (не короче 3 символов)';
		if (basis.trim().length < 3) next.legal_basis = 'Укажите правовое основание';
		errors = next;
		if (Object.keys(next).length || busy) return;
		busy = true;
		const body = { mode, reason: reason.trim(), legal_basis: basis.trim(), comment: comment.trim() || null, approval_id: approvalId };
		try {
			const out =
				subject.type === 'user'
					? await unwrap(api.POST('/api/admin/users/{user_id}/erasure-request', { params: { path: { user_id: subject.id } }, body }))
					: subject.type === 'contact'
						? await unwrap(api.POST('/api/admin/contacts/{contact_id}/erasure-request', { params: { path: { contact_id: subject.id } }, body }))
						: await unwrap(api.POST('/api/admin/organizations/{organization_id}/erasure-request', { params: { path: { organization_id: subject.id } }, body }));
			onCreated(out.id);
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1902') onPending(approvalIdFromError(e.extra));
			else errors = { form: e instanceof ApiError ? e.detail : 'Не удалось создать запрос' };
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} title="Удаление ПДн" size="m" saveLabel="Создать запрос" danger saveTestId="erasure-submit" saving={busy} dirty={open && (!!reason.trim() || !!basis.trim() || !!comment.trim())} formError={errors.form} onSave={submit} {onClose}>
	<p class="t-body-m-strong m-0 break-words">{subject.name}</p>
	<RadioField items={MODES} value={mode} onChange={(v) => (mode = v as ErasureMode)} />
	{#if mode === 'hard_delete'}<p class="t-desc-l m-0 text-muted">Только если нет связанных записей: сделок, задач, подписей.</p>{/if}
	<AreaField label="Причина" rows={2} value={reason} error={errors.reason} onInput={(v) => ((reason = v), delete errors.reason)} />
	<div class="flex flex-col gap-2">
		<TextField label="Правовое основание" value={basis} error={errors.legal_basis} onInput={(v) => ((basis = v), delete errors.legal_basis)} />
		<div class="flex flex-wrap gap-1">
			{#each LEGAL_BASIS_PRESETS as preset (preset)}
				<Chip size="s" variant="secondary" selected={basis === preset} label={preset.split(' — ')[0]} onclick={() => ((basis = preset), delete errors.legal_basis)} />
			{/each}
		</div>
	</div>
	<AreaField label="Комментарий (необязательно)" rows={2} value={comment} onInput={(v) => (comment = v)} />
</FormModal>
