<script lang="ts">
	// «Запросить доступ» к вузу, который ведёт коллега: причина (видит владелец и руководитель его команды), срок назначает тот, кто решает.
	// Ошибки сервера говорят сами: 409 — запрос уже ждёт ответа, 422 — доступ уже есть / вуз без ответственного / вне ваших ограничений.
	import { ApiError, api, errorTextWithCode, unwrap } from '$lib/api';
	import { AreaField, FormModal, toast } from '$lib/ui';
	import type { AccessRequest } from '../types';

	interface Props {
		open: boolean;
		orgId: string;
		/** название вуза, если известно (у недоступного его нет) */
		orgName?: string | null;
		onClose: () => void;
		onSent?: (request: AccessRequest) => void;
	}

	let { open, orgId, orgName = null, onClose, onSent }: Props = $props();

	let reason = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fieldError = $state<string | undefined>();

	$effect(() => {
		if (open) {
			reason = '';
			error = null;
			fieldError = undefined;
		}
	});

	async function submit() {
		if (busy) return;
		const text = reason.trim();
		if (!text) {
			fieldError = 'Напишите, зачем нужен доступ';
			return;
		}
		busy = true;
		error = null;
		try {
			const request = await unwrap(api.POST('/api/access-requests', { body: { entity_type: 'organization', entity_id: orgId, reason: text } }));
			toast.success('Запрос отправлен', 'Ответит владелец вуза или руководитель его команды');
			onSent?.(request);
			onClose();
		} catch (e) {
			error = e instanceof ApiError && e.status === 409 ? 'Запрос на этот вуз уже отправлен и ждёт ответа.' : errorTextWithCode(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} size="s" title="Запросить доступ" saveLabel="Отправить запрос" saving={busy} dirty={open && !!reason.trim()} formError={error} onSave={submit} {onClose}>
	<p class="t-body-m m-0 text-muted">
		{orgName ? `Вуз «${orgName}» ведёт другой менеджер.` : 'Этот вуз ведёт другой менеджер.'} Если запрос одобрят, вуз и его контакты появятся в вашем списке на срок, который назначит ответственный.
	</p>
	<AreaField label="Зачем нужен доступ" required rows={3} maxlength={1000} placeholder="Например, веду переговоры по курсу Python" value={reason} error={fieldError} onInput={(v) => ((reason = v), (fieldError = undefined))} onSubmit={submit} />
</FormModal>
