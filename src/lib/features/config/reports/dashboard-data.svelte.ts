// Данные виджетов дашборда. Каждый запуск отчёта = файл в хранилище + запись аудита, поэтому при открытии дашборда ничего не запускается:
// показывается кэш (sessionStorage, 5 минут, см. dashboard-cache.ts), а «Обновить данные» запускает отчёты пакетно (одинаковые — один раз, не больше двух одновременно).
import { errorMessage } from '$lib/api';
import { ReportFailed, ReportStillRunning, fetchReportData, isReportLimit, isTooManyRequests, startReport, waitForReport } from './api';
import { isReportBusy, normalizeParams, paramsFor } from './params';
import { readCache, writeCache, type CacheEntry } from './dashboard-cache';
import { fromReportData, type ReportTable } from './table';
import { effectiveParams, runKey, type WidgetConfig } from './widgets';

/** Сообщение виджета, который не обновился из-за лимита отчётов (прошлые данные остаются на месте). */
export const NOT_UPDATED = 'Не обновлено';

export class DashboardData {
	readonly dashboardId: string;
	entries = $state.raw<Record<string, CacheEntry>>({});
	loading = $state.raw<Record<string, boolean>>({});
	errors = $state.raw<Record<string, string>>({});
	refreshing = $state(false);
	/** хотя бы один виджет упёрся в лимит отчётов в работе */
	limited = $state(false);
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

	table(config: WidgetConfig): ReportTable | null {
		return this.entries[runKey(config)]?.table ?? null;
	}
	isLoading = (config: WidgetConfig): boolean => Boolean(this.loading[runKey(config)]);
	errorOf = (config: WidgetConfig): string | null => this.errors[runKey(config)] ?? null;
	/** на какой момент данные виджета: время построения на сервере, а если его нет — время запроса */
	asOf(config: WidgetConfig): number | null {
		const entry = this.entries[runKey(config)];
		if (!entry) return null;
		const built = entry.table.generatedAt ? Date.parse(entry.table.generatedAt) : Number.NaN;
		return Number.isFinite(built) ? built : entry.at;
	}
	/** самые давние данные среди виджетов */
	oldest(configs: readonly WidgetConfig[]): number | null {
		const times = configs.map((c) => this.asOf(c)).filter((t): t is number => t !== null);
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
		this.limited = false;
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
			const effective = effectiveParams(config);
			// каталог колонок здесь неизвестен: ключи выбранных колонок сервер проверит сам
			const columns = Array.isArray(effective.columns) ? effective.columns.map((k) => ({ key: String(k), title: String(k), default: false })) : undefined;
			const defs = paramsFor(config.template_code, {}, columns ? { columns } : undefined);
			let job = await startReport(config.template_code, 'xlsx', normalizeParams(defs, effective));
			if (isReportBusy(job.status)) job = await waitForReport(job, { signal });
			if (job.status === 'failed') throw new ReportFailed(job.error || 'Не удалось сформировать отчёт.');
			const table = fromReportData(await fetchReportData(job.id, signal));
			const entry: CacheEntry = { at: Date.now(), table, jobId: job.id };
			this.entries = { ...this.entries, [key]: entry };
			writeCache(this.dashboardId, key, entry);
		} catch (e) {
			if (signal.aborted) return;
			// лимит отчётов: фраза про него стоит один раз над сеткой, в карточке — коротко
			let message: string;
			if (isReportLimit(e)) {
				this.limited = true;
				message = NOT_UPDATED;
			} else if (e instanceof ReportStillRunning) message = 'Отчёт ещё формируется: обновите чуть позже';
			else message = isTooManyRequests(e) ? 'Слишком много запросов: подождите немного' : errorMessage(e);
			this.errors = { ...this.errors, [key]: message };
		} finally {
			this.loading = { ...this.loading, [key]: false };
		}
	}

	dispose(): void {
		this.#ctrl?.abort();
	}
}
