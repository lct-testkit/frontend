<script module lang="ts">
	export const meta = {
		block: 'B14',
		title: 'Публичные страницы: вход, подпись, проверка, приглашение',
		note: 'Своего эталона у DS нет — страницы собраны из блоков приложения. Рамка публичных страниц (PublicShell): бренд слева, переключатель темы справа — тот же значок, что в верхней панели приложения, одна центральная колонка (560 px; страница подписи с документом — 760). Карточки — одна рамка без тени (тень только у панели кода на телефоне: она выезжает снизу). Поля публичных страниц — размера l (48 px) и на десктопе: их заполняют разово, без привычки. Кнопки размера l; главная первой, на телефоне столбиком, главная внизу. Результат подписи (SignOutcome) — крупный значок, заголовок, пояснение и одно действие. Вход — два столбца: цветная панель с брендом и выбор роли (демо) или кнопка «Войти» (боевой режим); на телефоне — один столбец.'
	};
</script>

<script lang="ts">
	import { Card, EmptyState } from '$lib/ui';
	import InviteCard from '$lib/features/identity/InviteCard.svelte';
	import SignOutcome from '$lib/features/signing/SignOutcome.svelte';
	import VerifyForm from '$lib/features/signing/VerifyForm.svelte';
	import DemoState from '../DemoState.svelte';

	const OUTCOMES = ['signed', 'rejected', 'signed_before', 'expired', 'waiting', 'invalid', 'locked', 'void'] as const;
</script>

<DemoState title="Проверка подписи: идентификатор и поиск по файлу" bare>
	<div class="flex max-w-[560px] flex-col gap-4"><VerifyForm /></div>
</DemoState>

<DemoState title="Приглашение: карточка и недействительная ссылка" bare>
	<div class="grid max-w-[1140px] grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		<InviteCard fullName="Иван Иванов" emailMasked="iv***@rt-it-school.ru" expiresAt="2026-09-28T12:00:00Z" onContinue={() => {}} />
		<div class="rounded-lg border border-line bg-surface">
			<EmptyState title="Ссылка недействительна" hint="Она истекла или уже использована. Попросите администратора отправить приглашение повторно." />
		</div>
	</div>
</DemoState>

<DemoState title="Результат подписи: подписан · отклонён · уже подписан · срок истёк · не ваша очередь · ссылка недействительна · заблокировано · аннулирован" bare>
	<div class="grid max-w-[1140px] grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		{#each OUTCOMES as outcome (outcome)}
			<SignOutcome {outcome} title={outcome === 'signed' ? 'КП по сделке D-2026-000013' : null} />
		{/each}
	</div>
</DemoState>

<DemoState title="Одна карточка публичной страницы в теме страницы (для сравнения с карточкой приложения)" bare>
	<div class="grid max-w-[1140px] grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		<Card title="Карточка приложения">
			<p class="t-body-m">Граница 1 px, радиус 12, без тени; отступ 15 px.</p>
		</Card>
		<section class="rounded-lg border border-line bg-surface p-5 max-md:p-4">
			<h2 class="t-h4">Карточка публичной страницы</h2>
			<p class="t-body-m mt-2">Та же рамка, отступ 20 px (16 на телефоне): вокруг одна колонка, а не сетка страницы.</p>
		</section>
	</div>
</DemoState>
