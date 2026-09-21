<script lang="ts">
	// demo: pick an account, one click.  prod: sign in through Keycloak (the backend runs OIDC + PKCE and sets the session cookie).
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Loader } from '@lct-testkit/rt-ui';
	import { ArrowRight, SignIn } from '@lct-testkit/rt-ui/icons';
	import { errorMessage } from '$lib/api';
	import { session, ROLE_LABEL } from '$lib/auth/session.svelte';
	import { getConfig, type DemoAccount } from '$lib/config';
	import { landingFor } from '$lib/nav';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Brand from '$lib/ui/Brand.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';

	const cfg = getConfig();
	const ROLE_HINT: Record<string, string> = {
		KAM: 'Свои сделки, организации и подписи',
		HEAD: 'Сделки команды, импорт, переназначение',
		ADMIN: 'Воронки, пользователи, интеграции',
		AUDITOR: 'Только журнал аудита'
	};

	let busy = $state<string | null>(null);
	let failure = $state<string | null>(null);

	/** only same-site relative paths: never redirect off-site */
	const next = $derived.by(() => {
		const raw = page.url.searchParams.get('next');
		return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
	});

	onMount(() => {
		if (session.status !== 'authenticated') void session.load();
	});

	$effect(() => {
		if (session.status === 'authenticated') void goto(next ?? landingFor((p) => session.can(p)), { replaceState: true });
	});

	async function pick(account: DemoAccount) {
		busy = account.username;
		failure = null;
		try {
			await session.loginDemo(account.username, account.password);
		} catch (e) {
			failure = errorMessage(e);
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>Вход · {cfg.appName}</title></svelte:head>

<div class="grid min-h-dvh grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-page max-[899px]:grid-cols-1">
	<aside class="flex flex-col justify-between gap-8 bg-linear-to-br from-accent-600 to-accent-900 p-12 text-white max-[899px]:hidden min-[900px]:[@media(max-height:640px)]:p-6" aria-hidden="true">
		<Brand size="l" onDark />
		<p class="t-h1 max-w-105 text-white">Сделки с вузами<br />под контролем</p>
	</aside>

	<main class="flex items-center justify-center p-6 max-[899px]:items-start max-[899px]:px-4 max-[899px]:py-8">
		<div class="flex w-full max-w-115 flex-col gap-5 max-[899px]:max-w-170">
			<div class="flex items-center gap-3">
				<span class="hidden max-[899px]:inline-flex"><Brand compact /></span>
				<h1 class="t-h2 flex-1">{cfg.mode === 'demo' ? 'Выберите роль' : 'Вход'}</h1>
				{#if cfg.mode === 'demo'}<StatusChip label="демо" tone="accent" />{/if}
			</div>

			{#if session.notice}
				<Notice class="shrink-0" tone="warning">{session.notice}</Notice>
			{/if}

			{#if session.status === 'loading'}
				<div class="flex justify-center p-8" aria-busy="true"><Loader size="m" /></div>
			{:else if session.error}
				<Notice class="shrink-0" tone="error" actions={[{ label: 'Повторить', onclick: () => session.load() }]}>{errorMessage(session.error)}</Notice>
			{:else if cfg.mode === 'demo'}
				<ul class="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[560px]:max-[899px]:grid-cols-2">
					{#each cfg.demoAccounts as account (account.username)}
						<li>
							<!-- карточка-кнопка целиком (аватар, роль, подсказка): в rt-ui нет кликабельной карточки -->
							<button
								class="flex min-h-18 w-full cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left text-fg transition hover:border-accent hover:shadow-s disabled:cursor-default disabled:opacity-60 disabled:hover:border-line disabled:hover:shadow-none"
								type="button"
								onclick={() => pick(account)}
								disabled={busy !== null}
								data-testid="demo-account-{account.username}"
							>
								<Avatar name={account.name} size={44} />
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="t-body-m-strong">{account.name}</span>
									<span class="t-desc-l text-muted">{ROLE_LABEL[account.role] ?? account.role}</span>
									<span class="t-desc-m truncate text-soft">{ROLE_HINT[account.role] ?? account.position ?? ''}</span>
								</span>
								<span class="inline-flex size-6 flex-none items-center justify-center [&_svg]:fill-soft">
									{#if busy === account.username}<Loader size="2xs" />{:else}<ArrowRight />{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
				{#if failure}<Notice class="shrink-0" tone="error">{failure}</Notice>{/if}
			{:else}
				<Btn label="Войти" icon={SignIn} size="l" block onclick={() => session.loginOidc(next ?? '/')} data-testid="oidc-login" />
			{/if}
		</div>
	</main>
</div>
