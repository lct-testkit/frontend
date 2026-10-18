// Отчёты, свёрнутые пользователем или не успевшие за время ожидания: отслеживаются на уровне модуля (не компонента), поэтому тост «Отчёт готов»
// приходит, даже если человек перешёл на другой экран. Опрос — раз в 3 секунды, до 10 минут, не больше 10 заданий, в скрытой вкладке пауза.
import { toast } from '$lib/ui/toast.svelte';
import { Poller } from '../shared/polling.svelte';
import { getReport } from './api';
import { isReportBusy } from './params';

const TRACK_INTERVAL = 3000;
export const TRACK_MAX_MS = 10 * 60_000;
export const TRACK_MAX_JOBS = 10;

interface Tracked {
	id: string;
	name: string;
	since: number;
}

const tracked = new Map<string, Tracked>();
let poller: Poller | null = null;

async function tick(): Promise<boolean> {
	for (const item of [...tracked.values()]) {
		if (Date.now() - item.since > TRACK_MAX_MS) {
			tracked.delete(item.id);
			continue;
		}
		try {
			const job = await getReport(item.id);
			if (isReportBusy(job.status)) continue;
			tracked.delete(item.id);
			if (job.status === 'completed') toast.success(`Отчёт «${item.name}» готов`, 'Скачать можно в «Мои отчёты»');
			else toast.error(new Error(job.error || 'Не удалось сформировать отчёт'), `Отчёт «${item.name}» не сформирован`);
		} catch {
			// сеть — повторим на следующем круге
		}
	}
	return tracked.size > 0;
}

/** Начинает следить за заданием; повторный вызов для того же задания ничего не меняет. */
export function track(job: { id: string }, name: string): void {
	if (tracked.has(job.id)) return;
	if (tracked.size >= TRACK_MAX_JOBS) {
		const oldest = [...tracked.values()].sort((a, b) => a.since - b.since)[0];
		tracked.delete(oldest.id);
	}
	tracked.set(job.id, { id: job.id, name, since: Date.now() });
	poller ??= new Poller(tick, { interval: TRACK_INTERVAL, maxErrors: 1000, pauseHidden: true });
	poller.start();
}

export const trackedCount = (): number => tracked.size;

/** Для тестов: забыть всё и остановить опрос. */
export function resetTracker(): void {
	tracked.clear();
	poller?.stop();
	poller = null;
}
