<script module lang="ts">
	export const meta = {
		block: 'B2',
		title: 'Боковое меню и бренд',
		note: 'Эталон: rt-ui/examples/crm → SideMenu. Логотип RostelecomB2C, название, пункты по правам роли, счётчик у «Подписания», свёрнутый режим (иконки и подсказки), на телефоне — то же меню в Drawer.'
	};
</script>

<script lang="ts">
	import { NAV } from '$lib/nav';
	import Brand from '$lib/ui/Brand.svelte';
	import SideNav from '$lib/ui/SideNav.svelte';
	import DemoState from '../DemoState.svelte';

	// КАМ видит рабочий блок, администратор — ещё «Настройку» и «Администрирование»
	const kam = NAV.filter((s) => s.id === 'work').map((s) => ({ ...s, items: s.items.filter((i) => ['home', 'deals', 'orgs', 'contacts', 'tasks', 'signing', 'reports', 'help'].includes(i.id)) }));
	const admin = NAV;
	let active = $state('/deals');
	const go = (href: string) => (active = href);
	const isActive = (item: { href: string }) => item.href === active;
</script>

<div class="flex flex-wrap items-start gap-6">
	<DemoState title="Развёрнуто, КАМ: счётчик «Подписание»" bare>
		<div class="h-[560px] overflow-hidden rounded-lg border border-line">
			<SideNav class="h-full" sections={kam} {isActive} counters={{ signing: 3 }} expanded onNavigate={go} onToggle={() => {}}>
				{#snippet brand()}<Brand />{/snippet}
			</SideNav>
		</div>
	</DemoState>

	<DemoState title="Свёрнуто: иконки, названия в подсказках" bare>
		<div class="h-[560px] overflow-hidden rounded-lg border border-line">
			<SideNav class="h-full" sections={kam} {isActive} counters={{ signing: 3 }} expanded={false} onNavigate={go} onToggle={() => {}}>
				{#snippet brand()}<Brand compact />{/snippet}
			</SideNav>
		</div>
	</DemoState>

	<DemoState title="Администратор: секции «Настройка» и «Администрирование»" bare>
		<div class="h-[720px] overflow-hidden rounded-lg border border-line">
			<SideNav class="h-full" sections={admin} {isActive} expanded onNavigate={go} onToggle={() => {}}>
				{#snippet brand()}<Brand />{/snippet}
			</SideNav>
		</div>
	</DemoState>
</div>
