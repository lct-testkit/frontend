<script lang="ts">
	// Кнопка «Версия для печати» заголовка справки: ведёт на печатную версию нужного руководства и сразу вызывает печать, когда та готова.
	import { goto } from '$app/navigation';
	import { Print } from '@lct-testkit/rt-ui/icons';
	import { Btn } from '$lib/ui';
	import type { PrintGuide } from './print';

	let { guide = 'user', label = 'Версия для печати' }: { guide?: PrintGuide; label?: string } = $props();
</script>

<Btn {label} icon={Print} variant="secondary" colorScheme="neutral" onclick={() => goto(`/help/print?guide=${guide}&print=1`)} data-testid="help-print-link" />
