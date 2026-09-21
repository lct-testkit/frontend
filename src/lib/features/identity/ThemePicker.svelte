<script lang="ts">
	// Оформление: светлая/тёмная тема и палитра. Применяется сразу и запоминается в браузере.
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { theme } from '$lib/stores/theme.svelte';
</script>

<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
	<SegmentedControl value={theme.mode} onChange={(v) => theme.set(`rtk_${theme.palette}_${v as 'light' | 'dark'}`)} size="m" aria-label="Тема">
		<Segment index="light" label="Светлая" />
		<Segment index="dark" label="Тёмная" />
	</SegmentedControl>
	<SegmentedControl value={theme.palette} onChange={(v) => theme.setPalette(v as 'default' | 'purple')} size="m" aria-label="Палитра">
		<Segment index="default" label="Ростелеком" />
		<Segment index="purple" label="Фиолетовая" />
	</SegmentedControl>
</div>
