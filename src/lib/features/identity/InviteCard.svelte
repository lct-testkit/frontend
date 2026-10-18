<script lang="ts">
	// The card of an invitation (the public page /invite/[token]): who is invited, until when the link works, and the form where the person sets the password
	// (no letter and no SMTP needed). After the password is accepted the card says so and leads to the sign-in.
	import { CheckSmall, PasswordHide, PasswordShow } from '@lct-testkit/rt-ui/icons';
	import { KeyValue, KeyValueList } from '$lib/ui';
	import Btn from '$lib/ui/Btn.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import type { InviteFlow } from './invite.svelte';

	interface Props {
		flow: InviteFlow;
		onContinue: () => void;
	}

	let { flow, onContinue }: Props = $props();

	let password = $state('');
	let repeat = $state('');
	let show = $state(false);
	let now = $state(Date.now());
	let blockedUntil = $state(0);

	const invite = $derived(flow.invite);
	const checks = $derived(flow.checks(password, repeat));
	const busy = $derived(flow.phase === 'submitting');
	const wait = $derived(Math.max(0, Math.ceil((blockedUntil - now) / 1000)));

	$effect(() => {
		if (!wait) return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	async function submit() {
		if (busy || wait || !flow.canSubmit(password, repeat)) return;
		const ok = await flow.submit(password, repeat);
		password = repeat = '';
		show = false;
		if (!ok && flow.retryAfter && flow.errors.form) {
			blockedUntil = Date.now() + flow.retryAfter * 1000;
			now = Date.now();
		}
	}

	const input = (set: (v: string) => void) => (v: string) => {
		set(v);
		flow.clearErrors();
	};
	const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

{#snippet iconSuffix()}
	{#if show}<PasswordHide />{:else}<PasswordShow />{/if}
{/snippet}

<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 max-md:p-4">
	<h1 class="t-h2 m-0">{flow.phase === 'done' ? 'Пароль задан' : 'Вас пригласили в CRM'}</h1>
	{#if invite}
		<KeyValueList columns={1}>
			{#if invite.full_name}<KeyValue label="Сотрудник" value={invite.full_name} />{/if}
			{#if invite.email_masked}<KeyValue label="Почта" value={invite.email_masked} />{/if}
			{#if flow.phase !== 'done'}<KeyValue label="Ссылка действует до" value={formatDateTime(invite.expires_at)} />{/if}
		</KeyValueList>
	{/if}

	{#if flow.phase === 'done'}
		<Notice class="shrink-0" tone="success" data-testid="invite-done">Пароль задан. Теперь войдите: ссылка приглашения больше не работает.</Notice>
		<Btn label="Войти" size="l" block onclick={onContinue} data-testid="invite-continue" />
	{:else}
		<form
			class="flex flex-col gap-4"
			onsubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<h2 class="t-body-m-strong m-0">Задайте пароль</h2>
			<TextField size="l" type={show ? 'text' : 'password'} label="Пароль" required value={password} error={flow.errors.next} {iconSuffix} onClickIconSuffix={() => (show = !show)} disabled={busy || !!wait} onInput={input((v) => (password = v))} name="new-password" autocomplete="new-password" />
			<TextField size="l" type={show ? 'text' : 'password'} label="Повторите пароль" required value={repeat} error={flow.errors.repeat} disabled={busy || !!wait} onInput={input((v) => (repeat = v))} name="new-password-repeat" autocomplete="new-password" />

			<ul class="t-desc-l m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1 p-0 max-md:grid-cols-1" aria-label="Требования к паролю">
				{#each checks as c (c.code)}
					<li class={['flex items-center gap-1', c.ok ? 'text-success' : 'text-muted']}>
						{#if c.ok}<CheckSmall size={16} class="fill-current" />{:else}<span class="inline-block size-4 text-center" aria-hidden="true">·</span>{/if}
						{c.label}
					</li>
				{/each}
			</ul>

			{#if flow.errors.form}
				<Notice class="shrink-0" tone="error" role="alert">{flow.errors.form}{#if wait} Повторите через {mmss(wait)}.{/if}</Notice>
			{/if}
			<Btn type="submit" label="Задать пароль" size="l" block loading={busy} disabled={!flow.canSubmit(password, repeat) || !!wait} data-testid="invite-submit" />
		</form>
	{/if}
</section>
