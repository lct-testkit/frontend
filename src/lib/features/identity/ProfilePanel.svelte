<script lang="ts">
	// Вкладка «Профиль»: кто я в системе, свои данные (имя, часовой пояс, телефон — `PATCH /api/me`) и оформление.
	// Роль, email и статус меняет только администратор — этой ручке они не переданы вовсе (422 «лишнее поле»).
	import { onMount } from 'svelte';
	import { ApiError, api, errorMessage, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { POLICY_TEXT } from '$lib/content/policy';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import FormRow from '$lib/ui/FormRow.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { roleLabel, userStatusMeta } from './labels';
	import Term from '$lib/ui/Term.svelte';
	import { USER_STATUS_HINTS, ROLE_HINTS } from './hints';
	import { buildMePatch, profileFormFromMe, validatePhone, type ProfileFormValues } from './profileForm';
	import ThemePicker from './ThemePicker.svelte';
	import { timezoneOptions } from './timezones';

	const me = $derived(session.me);
	const status = $derived(userStatusMeta(me?.status ?? ''));
	let policyOpen = $state(false);
	let teamName = $state<string | null>(null);

	let base = $state<ProfileFormValues>({ displayName: '', timezone: '', phone: '' });
	let values = $state<ProfileFormValues>({ displayName: '', timezone: '', phone: '' });
	let phoneError = $state<string | undefined>(undefined);
	let formError = $state<string | null>(null);
	let saving = $state(false);

	onMount(() => {
		if (me?.manager_id) people.ensure([me.manager_id]);
		// названия команд читает только администратор; остальным строку «Команда» не показываем
		if (me?.team_id && session.can('user:read')) {
			void api.GET('/api/admin/teams', { params: { query: { limit: 100 } } }).then(({ data }) => {
				teamName = data?.items.find((t) => t.id === me.team_id)?.name ?? null;
			});
		}
	});

	// форма заполняется один раз, когда профиль пришёл (а не при каждом изменении session.me — иначе, например, перезагрузка
	// профиля из PasswordPanel после смены пароля стёрла бы то, что здесь ещё не сохранено); после своего сохранения — явно, ниже
	let formReady = false;
	$effect(() => {
		if (!me || formReady) return;
		formReady = true;
		base = profileFormFromMe(me);
		values = { ...base };
	});

	const rows = $derived(
		me
			? [
					{ label: 'Email', value: me.email ?? '—' },
					{ label: 'Роль', value: roleLabel(me.role) },
					...(teamName ? [{ label: 'Команда', value: teamName }] : [])
				]
			: []
	);

	const dirty = $derived(Object.keys(buildMePatch(base, values)).length > 0);

	async function save() {
		phoneError = validatePhone(values.phone);
		if (phoneError || !dirty || saving) return;
		saving = true;
		formError = null;
		try {
			const next = await unwrap(api.PATCH('/api/me', { body: buildMePatch(base, values) }));
			session.me = next; // без перезагрузки: имя в шапке и везде, где читают session.me, обновится само
			base = profileFormFromMe(next);
			values = { ...base };
			toast.success('Профиль сохранён');
		} catch (e) {
			if (e instanceof ApiError && e.isValidation) {
				const fields = e.fieldErrors();
				phoneError = fields.phone ?? undefined;
				formError = fields.phone ? null : errorMessage(e);
			} else {
				formError = errorMessage(e);
			}
		} finally {
			saving = false;
		}
	}

	function reset() {
		values = { ...base };
		phoneError = undefined;
		formError = null;
	}
</script>

{#if me}
	<div class="flex flex-col gap-4">
		<section class="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 max-md:gap-3 max-md:p-3">
			<Avatar name={me.full_name} size={64} />
			<div class="min-w-0 flex-1">
				<h2 class="t-h3 m-0 break-words">{me.display_name || me.full_name}</h2>
				<div class="mt-1 flex flex-wrap items-center gap-2">
					<StatusChip label={status.label} tone={status.tone} hint={USER_STATUS_HINTS[me.status as keyof typeof USER_STATUS_HINTS]} />
					<span class="t-desc-l text-muted"><Term label={roleLabel(me.role)} hint={ROLE_HINTS[me.role as keyof typeof ROLE_HINTS]} /></span>
				</div>
			</div>
		</section>

		<section class="rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 [&_dt]:mt-1 max-md:grid-cols-1 max-md:gap-y-1">
				{#each rows as row (row.label)}
					<dt class="t-desc-l text-muted">{row.label}</dt>
					<dd class="t-body-m m-0 mb-2 break-words md:mb-0">{row.value}</dd>
				{/each}
				<dt class="t-desc-l text-muted">Последний вход</dt>
				<dd class="t-body-m m-0 mb-2 md:mb-0"><DateText value={me.last_login_at} time relative /></dd>
				<dt class="t-desc-l text-muted">Согласие на ПДн</dt>
				<dd class="t-body-m m-0 flex flex-wrap items-center gap-x-3">
					<span>версия {me.consent_version ?? '—'}</span>
					<Btn label="Читать политику" variant="ghost" size="s" onclick={() => (policyOpen = true)} />
				</dd>
			</dl>
		</section>

		<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<h2 class="t-body-m-strong m-0">Изменить профиль</h2>
			<div class="flex max-w-[560px] flex-col gap-4">
				<TextField label="Отображаемое имя" placeholder={me.full_name} hint="Если оставить пустым, показывается ФИО." maxlength={255} value={values.displayName} disabled={saving} onInput={(v) => (values.displayName = v)} />
				<FormRow>
					<Pick label="Часовой пояс" items={timezoneOptions(values.timezone)} value={values.timezone} disabled={saving} onChange={(v) => v && (values.timezone = v)} />
					<TextField label="Телефон" hint="Нужен для кода подтверждения подписи по SMS." inputmode="tel" placeholder="+7 900 000-00-00" value={values.phone} error={phoneError} disabled={saving} onInput={(v) => ((values.phone = v), (phoneError = undefined))} onEnter={save} />
				</FormRow>
				{#if formError}<Notice class="shrink-0" tone="error" role="alert">{formError}</Notice>{/if}
				<div class="flex gap-2">
					<Btn label="Сохранить" loading={saving} disabled={!dirty || !!phoneError} onclick={save} data-testid="profile-save" />
					{#if dirty}<Btn label="Отмена" variant="ghost" colorScheme="neutral" disabled={saving} onclick={reset} />{/if}
				</div>
			</div>
		</section>

		<section class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<h2 class="t-body-m-strong m-0">Оформление</h2>
			<ThemePicker />
		</section>
	</div>

	<AppModal open={policyOpen} title="Политика обработки персональных данных" size="l" onClose={() => (policyOpen = false)}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- the text of the policy: our own markdown, rendered through DOMPurify -->
		<div class="md">{@html renderMarkdown(POLICY_TEXT)}</div>
		{#snippet footer()}<Btn label="Закрыть" onclick={() => (policyOpen = false)} />{/snippet}
	</AppModal>
{/if}
