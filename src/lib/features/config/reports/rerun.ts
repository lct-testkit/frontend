// «Запустить заново» из «Моих отчётов»: параметры прошлого запуска переходят в панель запуска. Хранятся в памяти страницы (переход внутри приложения),
// забираются один раз; после перезагрузки страницы панель откроется с параметрами по умолчанию.
export interface RerunRequest {
	code: string;
	params: Record<string, unknown>;
	format: string;
}

let pending: RerunRequest | null = null;

export function setRerun(request: RerunRequest): void {
	pending = request;
}

/** Забирает запрос для шаблона; для другого шаблона или повторно — `null`. */
export function takeRerun(code: string): RerunRequest | null {
	const request = pending;
	pending = null;
	return request && request.code === code ? request : null;
}

/** Оставляет только те параметры, которые знает форма шаблона (служебные и устаревшие ключи отбрасываются). */
export function knownParams(params: Record<string, unknown>, keys: Iterable<string>): Record<string, unknown> {
	const known = new Set(keys);
	return Object.fromEntries(Object.entries(params).filter(([k, v]) => known.has(k) && v !== null && v !== undefined));
}
