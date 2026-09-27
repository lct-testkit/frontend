<script lang="ts">
	// Правка карточки сотрудника (PATCH с If-Match). Отправляем только изменённые поля; смена роли — с подтверждением.
	import { untrack } from 'svelte';
	import { ApiError, api, ifMatch, unwrap } from '$lib/api';
	import { FormDrawer, FormRow, Pick, TextField, UserPicker } from '$lib/ui';
	import { confirm } from '$lib/ui/confirm.svelte';
	import { ASSIGNABLE_ROLES, ROLE_LABEL, roleLabel } from '../labels';
	import { teams } from '../teams.svelte';
	import type { Role, UserOut } from '../types';

	interface Props {
		open: boolean;
		user: UserOut;
		onClose: () => void;
		onSaved: (user: UserOut) => void;
		/** данные на сервере новее — родитель перечитывает карточку */
		onStale: () => Promise<void>;
	}

	let { open, user, onClose, onSaved, onStale }: Props = $props();

	const ZONES = ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'];

	let displayName = $state('');
	let position = $state('');
	let role = $state<Role>('KAM');
	let teamId = $state<string | null>(null);
	let managerId = $state<string | null>(null);
	let timezone = $state('Europe/Moscow');
	let locale = $state('ru');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let stale = $state(false);

	// форма заполняется при открытии; обновление карточки (конфликт версий) введённое не затирает
	$effect(() => {
		if (!open) return;
		untrack(() => {
			displayName = user.display_name ?? '';
			position = user.position ?? '';
			role = user.role as Role;
			teamId = user.team_id ?? null;
			managerId = user.manager_id ?? null;
			timezone = user.timezone;
			locale = user.locale;
			busy = stale = false;
			error = null;
			void teams.load();
		});
	});

	const roles = ASSIGNABLE_ROLES.map((r) => ({ key: r, value: ROLE_LABEL[r] }));
	const zones = $derived((ZONES.includes(user.timezone) ? ZONES : [user.timezone, ...ZONES]).map((z) => ({ key: z, value: z })));
	const locales = [
		{ key: 'ru', value: 'Русский' },
		{ key: 'en', value: 'English' }
	];

	function changes() {
		const patch: Record<string, unknown> = {};
		if ((displayName.trim() || null) !== (user.display_name ?? null)) patch.display_name = displayName.trim() || null;
		if ((position.trim() || null) !== (user.position ?? null)) patch.position = position.trim() || null;
		if (role !== user.role) patch.role = role;
		if (teamId !== (user.team_id ?? null)) patch.team_id = teamId;
		if (managerId !== (user.manager_id ?? null)) patch.manager_id = managerId;
		if (timezone !== user.timezone) patch.timezone = timezone;
		if (locale !== user.locale) patch.locale = locale;
		return patch;
	}
	const dirty = $derived(Object.keys(changes()).length > 0);

	async function save() {
		const patch = changes();
		if (!Object.keys(patch).length || busy) return;
		if (patch.role && role === 'HEAD' && !teamId) {
			error = 'Руководителю нужна команда';
			return;
		}
		if (patch.role && !(await confirm({ title: `Сменить роль на «${roleLabel(role)}»?`, message: 'Права изменятся сразу, сотрудник получит новый набор доступов.', confirmLabel: 'Сменить' }))) return;
		busy = true;
		error = null;
		try {
			const next = await unwrap(api.PATCH('/api/admin/users/{user_id}', { params: { path: { user_id: user.id } }, body: patch, headers: ifMatch(user.version) }));
			onSaved(next);
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1002') {
				stale = true;
				await onStale();
			} else if (e instanceof ApiError && e.code === 'CRM-1903') error = 'Нельзя менять роль последнего администратора.';
			else error = e instanceof ApiError ? e.detail : 'Не удалось сохранить';
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer {open} title="Изменить данные" width={520} saveTestId="user-save" saving={busy} {dirty} canSave={dirty} conflict={stale} conflictText="Карточку изменил другой администратор. Мы обновили данные — проверьте поля и сохраните ещё раз." formError={error} onSave={save} {onClose}>
	<TextField label="Отображаемое имя" value={displayName} maxlength={255} onInput={(v) => (displayName = v)} />
	<TextField label="Должность" value={position} maxlength={255} onInput={(v) => (position = v)} />
	<Pick label="Роль" items={roles} value={role} onChange={(v) => v && (role = v as Role)} />
	<Pick label="Команда" required={role === 'HEAD'} items={teams.options} value={teamId} clearable onChange={(v) => (teamId = v)} />
	<UserPicker label="Руководитель" roles={['HEAD', 'ADMIN']} value={managerId} exclude={[user.id]} onChange={(id) => (managerId = id)} />
	<FormRow>
		<Pick label="Часовой пояс" items={zones} value={timezone} onChange={(v) => v && (timezone = v)} />
		<Pick label="Язык" items={locales} value={locale} onChange={(v) => v && (locale = v)} />
	</FormRow>
</FormDrawer>
