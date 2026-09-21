<script lang="ts">
	// Вкладка «Безопасность»: смена пароля. Подсказки политики — до отправки, окончательно проверяет сервер.
	import { CheckSmall, PasswordHide, PasswordShow } from '@lct-testkit/rt-ui/icons';
	import { ApiError, api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { plural } from '$lib/utils/format';
	import { passwordChecks, passwordServerError, passwordValid } from './password';

	let current = $state('');
	let next = $state('');
	let repeat = $state('');
	let show = $state(false);
	let busy = $state(false);
	let errors = $state<{ current?: string; next?: string; repeat?: string; form?: string }>({});
	let done = $state<{ sessions: number; voided: number } | null>(null);
	let blockedUntil = $state(0);
	let now = $state(Date.now());

	const checks = $derived(passwordChecks({ current, next, repeat, email: session.me?.email }));
	const valid = $derived(current.length > 0 && passwordValid(checks));
	const wait = $derived(Math.max(0, Math.ceil((blockedUntil - now) / 1000)));

	$effect(() => {
		if (!wait) return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	async function submit() {
		if (!valid || busy || wait) return;
		busy = true;
		errors = {};
		try {
			const out = await unwrap(api.POST('/api/me/password', { body: { current_password: current, new_password: next, new_password_repeat: repeat } }));
			done = { sessions: out.sessions_terminated, voided: out.signature_requests_voided };
			current = next = repeat = '';
			toast.success('Пароль изменён');
			void session.reload().catch(() => {});
		} catch (e) {
			if (e instanceof ApiError && e.status === 429) {
				blockedUntil = Date.now() + (e.retryAfter ?? 900) * 1000;
				now = Date.now();
				errors = { form: 'Слишком много попыток смены пароля.' };
			} else {
				const info = passwordServerError(e instanceof ApiError ? e.detail : null);
				errors = info.field ? { [info.field]: info.message } : { form: info.message };
			}
		} finally {
			busy = false;
		}
	}

	const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

{#snippet iconSuffix()}
	{#if show}<PasswordHide />{:else}<PasswordShow />{/if}
{/snippet}

<div class="flex max-w-[560px] flex-col gap-4">
	{#if session.passwordChangeRequired}
		<Notice class="shrink-0" tone="warning" role="alert">Смените пароль: пока этого не сделано, часть действий недоступна.</Notice>
	{/if}
	{#if session.mode === 'demo'}
		<Notice class="shrink-0" tone="info">Демо-режим: смена пароля изменит его и для входа в один клик у этой учётной записи.</Notice>
	{/if}

	{#if done}
		<Notice class="shrink-0" tone="success" title="Пароль изменён" data-testid="password-done">
			Завершено {done.sessions} {plural(done.sessions, ['сессия', 'сессии', 'сессий'])}{#if done.voided}, аннулировано {done.voided} {plural(done.voided, ['запрос подписи', 'запроса подписи', 'запросов подписи'])}{/if}.
		</Notice>
	{/if}

	<form
		class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 max-md:p-3"
		onsubmit={(e) => {
			e.preventDefault();
			void submit();
		}}
	>
		<h2 class="t-body-m-strong m-0">Сменить пароль</h2>
		<TextField type={show ? 'text' : 'password'} label="Текущий пароль" value={current} error={errors.current} {iconSuffix} onClickIconSuffix={() => (show = !show)} disabled={!!wait} onInput={(v) => ((current = v), (errors = {}))} name="current-password" autocomplete="current-password" />
		<TextField type={show ? 'text' : 'password'} label="Новый пароль" value={next} error={errors.next} disabled={!!wait} onInput={(v) => ((next = v), (errors = {}))} name="new-password" autocomplete="new-password" />
		<TextField type={show ? 'text' : 'password'} label="Повторите новый пароль" value={repeat} error={errors.repeat} disabled={!!wait} onInput={(v) => ((repeat = v), (errors = {}))} name="new-password-repeat" autocomplete="new-password" />

		<ul class="t-desc-l m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 max-md:grid-cols-1" aria-label="Требования к паролю">
			{#each checks as c (c.code)}
				<li class={['flex items-center gap-1', c.ok ? 'text-success' : 'text-muted']}>
					{#if c.ok}<CheckSmall size={16} class="fill-current" />{:else}<span class="inline-block size-4 text-center" aria-hidden="true">·</span>{/if}
					{c.label}
				</li>
			{/each}
		</ul>

		{#if errors.form}
			<Notice class="shrink-0" tone="error">{errors.form}{#if wait} Повторите через {mmss(wait)}.{/if}</Notice>
		{/if}
		<Btn type="submit" label="Сменить пароль" loading={busy} disabled={!valid || !!wait} class="self-start max-md:w-full" data-testid="password-submit" />
	</form>
</div>
