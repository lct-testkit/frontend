// «Проверить сейчас»: по каждому ВКЛЮЧЁННОМУ источнику — POST /sources/{code}/check (один безопасный запрос к внешней системе, ничего не меняет).
// Итог — «Проверено в 01:32: 1 из 1 отвечает» и причина у тех, кто не ответил. Выключенные не проверяются (бэкенд ответил бы 409).
import { api, ApiError, errorMessage, unwrap } from '$lib/api';
import { formatTime } from '$lib/utils/format';

export interface CheckTarget {
	code: string;
	name: string;
	is_active: boolean;
}

export interface CheckResult {
	code: string;
	name: string;
	ok: boolean;
	/** «Отвечает» или причина по-русски */
	message: string;
	durationMs: number | null;
}

export interface CheckSummary {
	/** «Проверено в 01:32: 1 из 1 отвечает» */
	text: string;
	allOk: boolean;
	failed: CheckResult[];
}

export interface CheckDeps {
	check(code: string): Promise<{ ok: boolean; message: string; duration_ms: number }>;
	now(): Date;
}

const liveDeps: CheckDeps = {
	check: (code) => unwrap(api.POST('/api/admin/integrations/sources/{code}/check', { params: { path: { code } } })),
	now: () => new Date()
};

/** Понятный текст, когда проверка не состоялась: лимит 20 в минуту, источник уже выключили, сеть. */
function checkFailure(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.status === 429) return 'Слишком много проверок подряд. Подождите минуту и повторите.';
		if (e.code === 'CRM-1703' || e.status === 409) return 'Источник выключен: проверять нечего.';
	}
	return errorMessage(e);
}

const word = (n: number): string => (n === 1 ? 'отвечает' : 'отвечают');

function summarize(results: readonly CheckResult[], at: Date): CheckSummary {
	const ok = results.filter((r) => r.ok).length;
	return {
		text: `Проверено в ${formatTime(at)}: ${ok} из ${results.length} ${word(results.length)}`,
		allOk: ok === results.length,
		failed: results.filter((r) => !r.ok)
	};
}

export class SourceChecks {
	running = $state(false);
	summary = $state<CheckSummary | null>(null);
	#deps: CheckDeps;

	constructor(deps: CheckDeps = liveDeps) {
		this.#deps = deps;
	}

	/** Проверяет только включённые; без них — ничего не делает. Все запросы параллельно (источников три, лимит 20 в минуту). */
	async run(sources: readonly CheckTarget[]): Promise<void> {
		const active = sources.filter((s) => s.is_active);
		if (this.running || !active.length) return;
		this.running = true;
		try {
			const results = await Promise.all(
				active.map(async (s): Promise<CheckResult> => {
					try {
						const res = await this.#deps.check(s.code);
						return { code: s.code, name: s.name, ok: res.ok, message: res.message, durationMs: res.duration_ms };
					} catch (e) {
						return { code: s.code, name: s.name, ok: false, message: checkFailure(e), durationMs: null };
					}
				})
			);
			this.summary = summarize(results, this.#deps.now());
		} finally {
			this.running = false;
		}
	}

	/** Результат устарел (источник включили/выключили, настройки изменились). */
	clear(): void {
		this.summary = null;
	}
}
