<script lang="ts">
	// Создание сотрудника: минимум полей (ФИО, email, роль), остальное — в «Дополнительно». Создание администратора
	// уходит на подтверждение второго администратора («четыре глаза», CRM-1902).
	import { untrack } from 'svelte';
	import { ApiError, api, unwrap, idem } from '$lib/api';
	import { FormModal, FormSection, Pick, TextField, Toggle, UserPicker } from '$lib/ui';
	import { approvalIdFromError } from '../approvals';
	import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../labels';
	import { teams } from '../teams.svelte';
	import type { Role, UserCreated } from '../types';

	interface Initial {
		full_name?: string;
		email?: string;
		role?: string;
		approval_id?: string;
	}

	interface Props {
		open: boolean;
		initial?: Initial;
		onClose: () => void;
		onCreated: (res: UserCreated) => void;
		/** создание администратора ушло на подтверждение */
		onPending: (approvalId: string | null) => void;
	}

	let { open, initial = {}, onClose, onCreated, onPending }: Props = $props();

	let fullName = $state('');
	let email = $state('');
	let role = $state<Role>('KAM');
	let teamId = $state<string | null>(null);
	let managerId = $state<string | null>(null);
	let position = $state('');
	let totp = $state(false);
	let busy = $state(false);
	let errors = $state<Record<string, string>>({});
	let duplicate = $state<string | null>(null);
	let key = idem();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			fullName = initial.full_name ?? '';
			email = initial.email ?? '';
			role = (ASSIGNABLE_ROLES as string[]).includes(initial.role ?? '') ? (initial.role as Role) : 'KAM';
			teamId = managerId = null;
			position = '';
			totp = false;
			errors = {};
			duplicate = null;
			busy = false;
			key = idem();
			void teams.load();
		});
	});

	const dirty = $derived(open && (fullName.trim() !== (initial.full_name ?? '') || email.trim() !== (initial.email ?? '') || !!teamId || !!managerId || !!position.trim() || totp));
	const roles = ASSIGNABLE_ROLES.map((r) => ({ key: r, value: ROLE_LABEL[r] }));

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (fullName.trim().length < 2) next.full_name = 'Укажите фамилию и имя';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Введите корректный email';
		if (role === 'HEAD' && !teamId) next.team_id = 'Руководителю нужна команда';
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function submit() {
		if (busy || !validate()) return;
		busy = true;
		duplicate = null;
		try {
			const res = await unwrap(
				api.POST('/api/admin/users', {
					body: {
						full_name: fullName.trim(),
						email: email.trim(),
						role,
						team_id: teamId,
						manager_id: managerId,
						position: position.trim() || null,
						require_totp: totp,
						approval_id: initial.approval_id ?? null
					},
					headers: key
				})
			);
			onCreated(res);
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1902') onPending(approvalIdFromError(e.extra));
			else if (e instanceof ApiError && e.code === 'CRM-1301') {
				errors = { email: 'Пользователь с таким email уже есть' };
				duplicate = typeof e.extra.user_id === 'string' ? e.extra.user_id : null;
			} else if (e instanceof ApiError && e.status === 422) {
				const fields = e.fieldErrors();
				errors = Object.keys(fields).length ? fields : { form: e.detail };
			} else errors = { form: e instanceof ApiError ? e.detail : 'Не удалось создать пользователя' };
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} title="Новый сотрудник" size="m" saveLabel="Создать" saveTestId="user-create-submit" saving={busy} {dirty} formError={errors.form} onSave={submit} {onClose}>
	<TextField label="Фамилия и имя" autofocus value={fullName} error={errors.full_name} onInput={(v) => ((fullName = v), delete errors.full_name)} />
	<TextField label="Email" type="email" value={email} error={errors.email} onInput={(v) => ((email = v), delete errors.email)} />
	{#if duplicate}<a class="t-body-s" href="/admin/users/{duplicate}">Открыть существующего пользователя</a>{/if}
	<Pick label="Роль" items={roles} value={role} onChange={(v) => v && (role = v as Role)} />

	<FormSection collapsible open={role === 'HEAD'}>
		<Pick label="Команда" items={teams.options} value={teamId} clearable error={errors.team_id} onChange={(v) => ((teamId = v), delete errors.team_id)} />
		<UserPicker label="Руководитель" roles={['HEAD', 'ADMIN']} value={managerId} onChange={(id) => (managerId = id)} />
		<TextField label="Должность" value={position} maxlength={255} onInput={(v) => (position = v)} />
		<Toggle label="Требовать второй фактор (TOTP)" checked={totp} onChange={(v) => (totp = v)} />
	</FormSection>
</FormModal>
