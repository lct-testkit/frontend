// Автоподстановка организации (dop.md §11.5): ввод «ИНН или название» → подсказки из локального реестра ЕГРЮЛ и наших организаций.
// ИНН целиком проверяем по контрольной сумме сразу (без запроса) и затем берём карточку реестра; иначе — подсказки по названию / части ИНН.
import { api, ApiError, errorMessage, unwrap } from '$lib/api';
import { debounce } from '$lib/utils/debounce';
import { looksLikeInn, normalizeRequisite, validateInn } from '../requisites/validators';
import type { OrgDetails, OrgSuggestion } from '../types';

export interface LookupHit {
	inn: string;
	name: string;
	region: string | null;
	status: string;
	liquidated: boolean;
	provider: string;
}

/** Что отдаём формам после выбора. `details` — полная карточка реестра (если ИНН найден в нём). */
export interface OrgLookupEntry {
	inn: string;
	name: string;
	details: OrgDetails | null;
	provider: string;
}

const MIN_CHARS = 2;

export class OrgLookupState {
	query = $state('');
	hits = $state<LookupHit[]>([]);
	loading = $state(false);
	/** подсказка под полем: ошибка контрольной суммы, «не найдено», лимит запросов */
	message = $state<{ tone: 'error' | 'info'; text: string } | null>(null);

	#seq = 0;
	#run = debounce((text: string) => void this.#search(text), 300);

	input(text: string): void {
		this.query = text;
		this.#run(text);
		if (text.trim().length < MIN_CHARS) this.#reset();
	}

	/** Подставить значение и сразу искать (например, ИНН из ссылки). */
	set(text: string): void {
		this.query = text;
		this.#run.cancel();
		void this.#search(text);
	}

	clear(): void {
		this.query = '';
		this.#run.cancel();
		this.#reset();
	}

	#reset(): void {
		this.#seq += 1;
		this.hits = [];
		this.message = null;
		this.loading = false;
	}

	async #search(raw: string): Promise<void> {
		const text = raw.trim();
		if (text.length < MIN_CHARS) return;
		const mine = ++this.#seq;
		const digits = normalizeRequisite(text);
		this.loading = true;
		this.message = null;
		try {
			if (/^\d+$/.test(digits) && (digits.length === 10 || digits.length === 12)) {
				await this.#byInn(digits, mine);
			} else {
				const { items } = await unwrap(api.GET('/api/org-lookup/suggest', { params: { query: { q: text, limit: 8 } } }));
				if (mine !== this.#seq) return;
				this.hits = (items ?? []).map(fromSuggestion);
				if (!this.hits.length) this.message = { tone: 'info', text: looksLikeInn(digits) ? 'Не найдено' : 'В реестре ничего не нашлось — можно заполнить вручную' };
			}
		} catch (e) {
			if (mine !== this.#seq) return;
			this.hits = [];
			this.message = { tone: 'error', text: e instanceof ApiError && e.status === 429 ? `Слишком много запросов, подождите ${e.retryAfter ?? 10} с` : errorMessage(e) };
		} finally {
			if (mine === this.#seq) this.loading = false;
		}
	}

	async #byInn(inn: string, mine: number): Promise<void> {
		const check = validateInn(inn);
		if (!check.ok) {
			this.hits = [];
			this.message = { tone: 'error', text: check.reason ?? 'Неверный ИНН' };
			return;
		}
		const details = await unwrap(api.GET('/api/org-lookup/inn/{inn}', { params: { path: { inn } } })).catch((e: unknown) => {
			if (e instanceof ApiError && e.isNotFound) return null;
			throw e;
		});
		if (mine !== this.#seq) return;
		if (details) {
			this.hits = [fromDetails(details)];
		} else {
			this.hits = [];
			this.message = { tone: 'info', text: 'ИНН верный, но в реестре его нет — заполните данные вручную' };
		}
	}

	/** Полная карточка выбранной подсказки. */
	async pick(hit: LookupHit): Promise<OrgLookupEntry> {
		let details: OrgDetails | null = null;
		try {
			details = await unwrap(api.GET('/api/org-lookup/inn/{inn}', { params: { path: { inn: hit.inn } } }));
		} catch (e) {
			if (!(e instanceof ApiError && e.isNotFound)) throw e;
		}
		return { inn: hit.inn, name: details?.full_name ?? hit.name, details, provider: hit.provider };
	}
}

function fromSuggestion(s: OrgSuggestion): LookupHit {
	return { inn: s.inn, name: s.name, region: s.region ?? null, status: s.status, liquidated: s.is_liquidated, provider: s.provider };
}

function fromDetails(d: OrgDetails): LookupHit {
	return { inn: d.inn, name: d.full_name, region: null, status: d.status, liquidated: d.status === 'liquidated', provider: d.provider };
}
