<script lang="ts">
	// Действия перехода карточками: задача, уведомление, запрос подписи, событие интеграции. Никакого JSON — только поля.
	import { AddLarge, Trash } from '@lct-testkit/rt-ui/icons';
	import { Btn, IconBtn } from '$lib/ui';
	import { NOTIFICATION_EVENT_CODES } from '../../labels';
	import {
		ACTION_LABELS,
		ACTION_TYPES,
		INTEGRATION_EVENTS,
		INTEGRATION_EVENT_LABELS,
		NOTIFY_CHANNELS,
		NOTIFY_CHANNEL_LABELS,
		NOTIFY_RECIPIENTS,
		NOTIFY_RECIPIENT_LABELS,
		ON_EXPIRED,
		ON_EXPIRED_LABELS,
		ON_REJECTED_PREVIOUS,
		ROLE_LABELS,
		SIGNATURE_ORDERS,
		SIGNATURE_ORDER_LABELS,
		TASK_ASSIGNEES,
		TASK_ASSIGNEE_LABELS,
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		newAction,
		type ActionType,
		type Signer,
		type TransitionAction
	} from '../dsl';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';

	interface Props {
		actions: TransitionAction[];
		/** живые статусы воронки: `{code, name}` — для «при отклонении вернуть в…» */
		statuses: readonly { code: string; name: string }[];
		templates: readonly { code: string; name: string }[];
		disabled?: boolean;
		onChange: (next: TransitionAction[]) => void;
	}

	let { actions, statuses, templates, disabled = false, onChange }: Props = $props();

	let adding = $state<string | null>(null);

	const update = (i: number, patch: Record<string, unknown>) => onChange(actions.map((a, k) => (k === i ? ({ ...a, ...patch } as TransitionAction) : a)));
	const remove = (i: number) => onChange(actions.filter((_, k) => k !== i));

	const ASSIGNEES = [
		...TASK_ASSIGNEES.map((a) => ({ key: `assignee:${a}`, value: TASK_ASSIGNEE_LABELS[a] })),
		{ key: 'role:HEAD', value: `Роль: ${ROLE_LABELS.HEAD}` },
		{ key: 'role:ADMIN', value: `Роль: ${ROLE_LABELS.ADMIN}` }
	];
	const eventItems = (current: string) => {
		const known = NOTIFICATION_EVENT_CODES.map((e) => ({ key: e.key, value: e.value, hint: e.key }));
		return current && !known.some((k) => k.key === current) ? [{ key: current, value: current }, ...known] : known;
	};
	const templateItems = (current: string) => (current && !templates.some((t) => t.code === current) ? [{ key: current, value: current }] : []).concat(templates.map((t) => ({ key: t.code, value: t.name })));

	const SIGNER_ROLES = (['KAM', 'HEAD', 'ADMIN'] as const).map((r) => ({ key: r, value: ROLE_LABELS[r] }));
	function signerKind(s: Signer): 'role' | 'contact_role' | 'user' {
		return s.role ? 'role' : s.contact_role !== undefined ? 'contact_role' : 'user';
	}
	function setSigner(i: number, k: number, signers: Signer[], next: Signer) {
		update(i, { signers: signers.map((s, n) => (n === k ? next : s)) });
	}
</script>

<div class="flex flex-col gap-2.5">
	{#each actions as action, i (i)}
		<div class="flex flex-col gap-2.5 rounded-md border border-line bg-surface p-2.5">
			<div class="flex items-center gap-2">
				<span class="t-body-s-strong min-w-0 flex-1">{ACTION_LABELS[action.type] ?? action.type}</span>
				{#if !disabled}<IconBtn icon={Trash} label="Убрать действие" danger size="s" onclick={() => remove(i)} />{/if}
			</div>

			{#if action.type === 'create_task'}
				<TextField label="Заголовок задачи" value={action.title} {disabled} onInput={(v) => update(i, { title: v })} />
				<Pick
					label="Исполнитель"
					items={ASSIGNEES}
					{disabled}
					value={action.assignee_role ? `role:${action.assignee_role}` : action.assignee ? `assignee:${action.assignee}` : null}
					onChange={(v) => {
						if (!v) return;
						const [kind, val] = v.split(':');
						update(i, kind === 'role' ? { assignee_role: val, assignee: undefined } : { assignee: val, assignee_role: undefined });
					}}
				/>
				<div class="grid grid-cols-2 gap-2">
					<NumberField label="Срок, дней" integer min={1} max={365} value={action.due_days ?? null} {disabled} onChange={(n) => update(i, { due_days: n ?? undefined })} />
					<Pick label="Приоритет" items={TASK_PRIORITIES.map((p) => ({ key: p, value: TASK_PRIORITY_LABELS[p] }))} value={action.priority ?? 'normal'} {disabled} onChange={(v) => v && update(i, { priority: v })} />
				</div>
			{:else if action.type === 'notify'}
				<Pick label="Событие" search items={eventItems(action.event_code)} value={action.event_code || null} {disabled} onChange={(v) => v && update(i, { event_code: v })} />
				<MultiPick label="Кому" search={false} items={NOTIFY_RECIPIENTS.map((r) => ({ key: r, value: NOTIFY_RECIPIENT_LABELS[r] }))} value={action.recipients ?? []} {disabled} onChange={(v) => update(i, { recipients: v.length ? v : undefined })} />
				<MultiPick label="Через" search={false} items={NOTIFY_CHANNELS.map((c) => ({ key: c, value: NOTIFY_CHANNEL_LABELS[c] }))} value={action.channels ?? []} {disabled} onChange={(v) => update(i, { channels: v.length ? v : undefined })} />
			{:else if action.type === 'request_signature'}
				<Pick label="Документ" search items={templateItems(action.template)} value={action.template || null} {disabled} emptyText="Шаблонов нет" onChange={(v) => v && update(i, { template: v })} />
				<div class="flex flex-col gap-1.5">
					<span class="t-desc-l text-muted">Подписанты</span>
					{#each action.signers ?? [] as signer, k (k)}
						<div class="flex items-start gap-1">
							<Pick
								class="w-30 flex-none"
								{disabled}
								value={signerKind(signer)}
								items={[
									{ key: 'role', value: 'Роль' },
									{ key: 'contact_role', value: 'Контакт' },
									...(signerKind(signer) === 'user' ? [{ key: 'user', value: 'Сотрудник', disabled: true }] : [])
								]}
								onChange={(v) => v && v !== 'user' && setSigner(i, k, action.signers, v === 'role' ? { role: 'HEAD' } : { contact_role: '' })}
							/>
							{#if signer.role}
								<Pick class="min-w-0 flex-1" {disabled} value={signer.role} items={SIGNER_ROLES} onChange={(v) => v && setSigner(i, k, action.signers, { role: v as Signer['role'] })} />
							{:else if signer.contact_role !== undefined}
								<TextField class="min-w-0 flex-1" placeholder="Должность контакта" value={signer.contact_role} {disabled} onInput={(v) => setSigner(i, k, action.signers, { contact_role: v })} />
							{:else}
								<span class="t-desc-l min-w-0 flex-1 self-center text-soft">Указанный сотрудник</span>
							{/if}
							{#if !disabled && action.signers.length > 1}<IconBtn icon={Trash} label="Убрать подписанта" size="s" danger onclick={() => update(i, { signers: action.signers.filter((_, n) => n !== k) })} />{/if}
						</div>
					{/each}
					{#if !disabled}<Btn label="Подписант" icon={AddLarge} size="s" variant="ghost" colorScheme="neutral" class="self-start" onclick={() => update(i, { signers: [...(action.signers ?? []), { role: 'HEAD' }] })} />{/if}
				</div>
				<div class="grid grid-cols-2 gap-2">
					<Pick label="Порядок" items={SIGNATURE_ORDERS.map((o) => ({ key: o, value: SIGNATURE_ORDER_LABELS[o] }))} value={action.order ?? 'sequential'} {disabled} onChange={(v) => v && update(i, { order: v })} />
					<NumberField label="Срок, дней" integer min={1} max={365} value={action.deadline_days ?? null} {disabled} onChange={(n) => update(i, { deadline_days: n ?? undefined })} />
				</div>
				<Pick
					label="При отклонении"
					items={[{ key: ON_REJECTED_PREVIOUS, value: 'Вернуть в предыдущий статус' }, ...statuses.map((s) => ({ key: s.code, value: `Перевести в «${s.name}»` }))]}
					value={action.on_rejected ?? ON_REJECTED_PREVIOUS}
					{disabled}
					onChange={(v) => v && update(i, { on_rejected: v })}
				/>
				<Pick label="При истечении срока" items={ON_EXPIRED.map((o) => ({ key: o, value: ON_EXPIRED_LABELS[o] }))} value={action.on_expired ?? 'notify_initiator'} {disabled} onChange={(v) => v && update(i, { on_expired: v })} />
			{:else if action.type === 'integration_event'}
				<Pick label="Событие" items={INTEGRATION_EVENTS.map((e) => ({ key: e, value: INTEGRATION_EVENT_LABELS[e] }))} value={action.event_code} {disabled} onChange={(v) => v && update(i, { event_code: v })} />
			{/if}
		</div>
	{/each}

	{#if !disabled}
		<Pick
			label="Добавить действие"
			bind:value={adding}
			items={ACTION_TYPES.map((t) => ({ key: t, value: ACTION_LABELS[t] }))}
			onChange={(t) => {
				if (t) onChange([...actions, newAction(t as ActionType)]);
				adding = null;
			}}
		/>
	{/if}
</div>
