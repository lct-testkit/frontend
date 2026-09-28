// Данные виджетов дашборда. Каждый запуск отчёта = файл в хранилище + запись аудита, поэтому при открытии дашборда ничего не запускается:
// показывается кэш (sessionStorage, 5 минут), а «Обновить данные» запускает отчёты пакетно (одинаковые — один раз, не больше двух одновременно).
import { errorMessage } from '$lib/api';
import { ReportFailed, fetchReportData, isRateLimited, startReport, waitForReport } from './api';
import { isReportBusy, normalizeParams, paramsFor } from './params';
import { fromReportData, type XlsxTable } from './xlsx';
import { runKey, type WidgetConfig } from './widgets';

const TTL_MS = 5 * 60_000;
const CACHE_ROWS = 300;

interface Entry {
	at: number;
	table: XlsxTable;
}

const cacheKey = (dashboardId: string, key: string) => `rtk.dash.${dashboardId}.${key}`;

function readCache(dashboardId: string, key: string): Entry | null {
	try {
		const raw = sessionStorage.getItem(cacheKey(dashboardId, key));
		if (!raw) return null;
		const entry = JSON.parse(raw) as Entry;
		return Date.now() - entry.at < TTL_MS ? entry : null;
	} catch {
		return null;
	}
}

function writeCache(dashboardId: string, key: string, entry: Entry): void {
	try {
		sessionStorage.setItem(cacheKey(dashboardId, key), JSON.stringify({ at: entry.at, table: { ...entry.table, rows: entry.table.rows.slice(0, CACHE_ROWS) } }));
	} catch {
		// кэш — удобство, а не необходимость
	}
}

export class DashboardData {
	readonly dashboardId: string;
	entries = $state.raw<Record<string, Entry>>({});
	loading = $state.raw<Record<string, boolean>>({});
	errors = $state.raw<Record<string, string>>({});
	refreshing = $state(false);
	#ctrl: AbortController | null = null;

	constructor(dashboardId: string) {
		this.dashboardId = dashboardId;
	}

	/** Подхватывает свежий кэш для ключей, которых ещё нет в памяти. */
	hydrate(configs: readonly WidgetConfig[]): void {
		const next = { ...this.entries };
		for (const c of configs) {
			const key = runKey(c);
			if (!next[key]) {
				const cached = readCache(this.dashboardId, key);
				if (cached) next[key] = cached;
			}
		}
		this.entries = next;
	}

	table(config: WidgetConfig): XlsxTable | null {
		return this.entries[runKey(config)]?.table ?? null;
	}
	isLoading = (config: WidgetConfig): boolean => Boolean(this.loading[runKey(config)]);
	errorOf = (config: WidgetConfig): string | null => this.errors[runKey(config)] ?? null;
	/** самое давнее обновление среди виджетов */
	oldest(configs: readonly WidgetConfig[]): number | null {
		const times = configs.map((c) => this.entries[runKey(c)]?.at).filter((t): t is number => typeof t === 'number');
		return times.length ? Math.min(...times) : null;
	}

	async refresh(configs: readonly WidgetConfig[]): Promise<void> {
		if (this.refreshing) return;
		this.#ctrl?.abort();
		const ctrl = (this.#ctrl = new AbortController());
		this.refreshing = true;
		const unique = new Map<string, WidgetConfig>();
		for (const c of configs) unique.set(runKey(c), c);
		const queue = [...unique.entries()];
		this.errors = {};
		const worker = async () => {
			for (let item = queue.shift(); item && !ctrl.signal.aborted; item = queue.shift()) await this.#runOne(item[0], item[1], ctrl.signal);
		};
		try {
			await Promise.all([worker(), worker()]);
		} finally {
			this.refreshing = false;
		}
	}

	async #runOne(key: string, config: WidgetConfig, signal: AbortSignal): Promise<void> {
		this.loading = { ...this.loading, [key]: true };
		try {
			const defs = paramsFor(config.template_code);
			let job = await startReport(config.template_code, 'xlsx', normalizeParams(defs, config.params ?? {}));
			if (isReportBusy(job.status)) job = await waitForReport(job, { signal });
			if (job.status === 'failed') throw new ReportFailed(job.error || 'Не удалось сформировать отчёт.');
			const table = fromReportData(await fetchReportData(job.id, signal));
			const entry = { at: Date.now(), table };
			this.entries = { ...this.entries, [key]: entry };
			writeCache(this.dashboardId, key, entry);
		} catch (e) {
			if (signal.aborted) return;
			const message = isRateLimited(e) ? 'Слишком много отчётов в работе — подождите и обновите ещё раз' : e instanceof ReportFailed || e instanceof Error ? errorMessage(e) : errorMessage(e);
			this.errors = { ...this.errors, [key]: message };
		} finally {
			this.loading = { ...this.loading, [key]: false };
		}
	}

	dispose(): void {
		this.#ctrl?.abort();
	}
}
