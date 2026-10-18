// Состояние мастера импорта: файл → сопоставление → проверка → применение → готово. Задание живёт на сервере, поэтому мастер
// восстанавливается по `?job=<id>` (обновление страницы и «Назад» не теряют прогресс).
import { goto } from '$app/navigation';
import { api, unwrap, idem, errorMessage, ApiError } from '$lib/api';
import { uploadFile } from '$lib/api/upload';
import { toast } from '$lib/ui';
import type { ImportJob, ImportPreset, ImportProfile } from '../types';
import { createPoller } from '../shared/polling.svelte';
import { loadEntityTypes, loadImportSummary } from './job';
import type { ImportSummary } from './check';
import {
	IMPORT_MAX_FILE_BYTES,
	applyPreset,
	applyPresetOptions,
	checkMapping,
	defaultOptionsForm,
	importTypeAvailable,
	importStep,
	isImportBusy,
	optionsPayload,
	presetKey,
	sourceFormatFromName,
	type ImportEntity,
	type ImportEntityType,
	type ImportMode,
	type ImportOptionsForm,
	type MappingCheck
} from './mapping';

export const WIZARD_STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Применение', 'Готово'] as const;

export class ImportFlow {
	step = $state(0);
	/** Типы сущностей с сервера: поля, форматы, что обязательно. Списки полей на клиенте не хранятся. */
	entityTypes = $state<ImportEntityType[]>([]);
	typesLoading = $state(false);
	typesError = $state<unknown>(null);
	entity = $state<ImportEntity>('organization');
	mode = $state<ImportMode>('upsert');
	file = $state<File | null>(null);
	fileError = $state<string | null>(null);
	uploading = $state(false);
	progress = $state(0);
	job = $state<ImportJob | null>(null);
	profile = $state<ImportProfile | null>(null);
	presets = $state<ImportPreset[]>([]);
	/** колонка файла → поле системы; пусто — не импортировать */
	mapping = $state<Record<string, string>>({});
	presetId = $state<string | null>(null);
	/** параметры чтения файла: лист, строка заголовка, заполнение сверху, создание справочников */
	options = $state<ImportOptionsForm>(defaultOptionsForm());
	/** пользователь менял параметры: без этого `options` в запрос не идёт и сохранённые на сервере остаются */
	optionsTouched = $state(false);
	/** сводка проверки (`GET /summary`) */
	summary = $state<ImportSummary | null>(null);
	/** предпросмотр другого листа / строки заголовка в пути */
	previewing = $state(false);
	savePreset = $state(false);
	presetName = $state('');
	loading = $state(false);
	/** идёт запрос шага (сохранение маппинга, проверка, применение, откат) */
	busy = $state(false);
	error = $state<unknown>(null);
	#ctrl: AbortController | null = null;

	headers = $derived(this.profile?.headers ?? []);
	entityType = $derived(this.entityTypes.find((t) => t.code === this.entity) ?? null);
	check = $derived<MappingCheck>(checkMapping(this.mapping, this.headers, this.entityType));
	rollingBack = $derived(this.job?.status === 'rolling_back');

	poller = createPoller(async () => {
		if (!this.job) return false;
		const job = await unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: this.job.id } } }));
		this.job = job;
		if (isImportBusy(job.status)) return true;
		this.step = 4;
		return false;
	});

	async loadTypes(): Promise<void> {
		if (this.entityTypes.length || this.typesLoading) return;
		this.typesLoading = true;
		this.typesError = null;
		try {
			this.entityTypes = await loadEntityTypes();
		} catch (e) {
			this.typesError = e;
		} finally {
			this.typesLoading = false;
		}
	}

	stop(): void {
		this.poller.stop();
		this.#ctrl?.abort();
	}

	// --- восстановление по ссылке ----------------------------------------------------------

	async restore(jobId: string): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			await this.loadTypes();
			const job = await unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: jobId } } }));
			this.job = job;
			this.entity = (job.entity_type as ImportEntity) ?? 'organization';
			this.mode = (job.mode as ImportMode) ?? 'upsert';
			const step = Math.min(4, Math.max(1, importStep(job.status)));
			this.step = step;
			if (step <= 2) await this.loadProfile();
			if (step === 2 && job.status === 'mapped') void this.dryRun();
			if (step === 3) this.poller.start(true);
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	// --- шаг 1: файл --------------------------------------------------------------------------

	pickFile(file: File | null): void {
		this.fileError = null;
		const format = file ? sourceFormatFromName(file.name) : null;
		const allowed = this.entityType?.source_formats;
		if (file && (!format || (allowed && !allowed.includes(format)))) {
			this.fileError = 'Подходят файлы Excel (.xlsx, .xls), CSV и JSON.';
			file = null;
		} else if (file && file.size > IMPORT_MAX_FILE_BYTES) {
			this.fileError = 'Файл больше 50 МБ. Разбейте его на части.';
			file = null;
		}
		this.file = file;
	}

	async upload(): Promise<void> {
		const file = this.file;
		if (!file || this.uploading) return;
		const format = sourceFormatFromName(file.name);
		if (!format) return;
		this.uploading = true;
		this.progress = 0;
		this.fileError = null;
		this.#ctrl = new AbortController();
		try {
			const uploaded = await uploadFile(file, { purpose: 'import', onProgress: (f) => (this.progress = f), signal: this.#ctrl.signal });
			const job = await unwrap(api.POST('/api/imports', { body: { file_id: uploaded.id, entity_type: this.entity, mode: this.mode, source_format: format }, headers: idem() }));
			this.job = job;
			this.step = 1;
			void goto(`/imports/new?job=${job.id}`, { replaceState: true, keepFocus: true, noScroll: true });
			await this.loadProfile();
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			this.fileError = e instanceof ApiError && e.code === 'CRM-1801' ? `${e.detail}` : errorMessage(e);
			this.step = 0;
		} finally {
			this.uploading = false;
		}
	}

	// --- шаг 2: сопоставление ------------------------------------------------------------------

	async loadProfile(): Promise<void> {
		if (!this.job) return;
		this.loading = true;
		this.error = null;
		try {
			const [profile, presets] = await Promise.all([
				unwrap(api.GET('/api/imports/{job_id}/profile', { params: { path: { job_id: this.job.id } } })),
				unwrap(api.GET('/api/import-presets', { params: { query: { entity_type: this.entity, limit: 100 } } })).then((r) => r.items).catch(() => [] as ImportPreset[])
			]);
			this.profile = profile;
			this.presets = presets;
			// что уже выбрано на сервере (лист, строка заголовка); остальное сервер назад не отдаёт — оно остаётся как есть, пока пользователь не изменит
			this.options = { ...defaultOptionsForm(), sheet: profile.sheet ?? null, headerRow: profile.header_row ?? null };
			this.optionsTouched = false;
			const saved = this.job.mapping && Object.keys(this.job.mapping).length ? this.job.mapping : profile.suggested_mapping;
			this.mapping = { ...saved };
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	/** Другой лист или строка заголовка: предпросмотр с сервера (ничего не сохраняет), колонки и подбор — по новому разбору. */
	async previewProfile(): Promise<void> {
		if (!this.job || this.previewing) return;
		this.previewing = true;
		try {
			const sheet = this.options.allSheets ? undefined : (this.options.sheet ?? undefined);
			const profile = await unwrap(
				api.GET('/api/imports/{job_id}/profile', { params: { path: { job_id: this.job.id }, query: { sheet, header_row: this.options.headerRow ?? undefined } } })
			);
			this.profile = profile;
			this.mapping = { ...profile.suggested_mapping };
			this.options.fillDown = this.options.fillDown.filter((h) => profile.headers.includes(h));
			this.presetId = null;
		} catch (e) {
			toast.error(e, 'Не удалось прочитать лист');
		} finally {
			this.previewing = false;
		}
	}

	/** Правка параметра чтения; лист и строка заголовка пересчитывают колонки. */
	setOptions(patch: Partial<ImportOptionsForm>, reread = false): void {
		this.options = { ...this.options, ...patch };
		this.optionsTouched = true;
		if (reread) void this.previewProfile();
	}

	/** Типы импорта, которые доступны этой роли (админские — только администратору). */
	typeAvailable(code: string, role: string | null | undefined): boolean {
		const type = this.entityTypes.find((t) => t.code === code);
		return type ? importTypeAvailable(type, role) : true;
	}

	setTarget(header: string, target: string | null): void {
		const next = { ...this.mapping };
		if (target) next[header] = target;
		else delete next[header];
		this.mapping = next;
		this.presetId = null;
	}

	usePreset(id: string | null): void {
		this.presetId = id;
		const preset = this.presets.find((p) => presetKey(p) === id);
		if (!preset) return;
		const before = this.options;
		this.options = applyPresetOptions(this.options, preset.options);
		const changed = this.options !== before;
		if (changed) this.optionsTouched = true;
		// у пресета свой лист / строка заголовка: сначала перечитать файл, потом накладывать колонки
		const reread = changed && (this.options.sheet !== before.sheet || this.options.headerRow !== before.headerRow || this.options.allSheets !== before.allSheets);
		const apply = () => (this.mapping = applyPreset(this.mapping, preset.mapping, this.headers));
		if (reread) void this.previewProfile().then(apply);
		else apply();
	}

	async saveMapping(): Promise<void> {
		if (!this.job || this.busy || !this.check.ok) return;
		this.busy = true;
		try {
			const mapping = Object.fromEntries(Object.entries(this.mapping).filter(([h, t]) => t && this.headers.includes(h)));
			this.job = await unwrap(
				api.PUT('/api/imports/{job_id}/mapping', {
					params: { path: { job_id: this.job.id } },
					body: { mapping, ...(this.optionsTouched ? { options: optionsPayload(this.options, this.headers, this.entity) } : {}), save_as_preset: this.savePreset && this.presetName.trim() ? this.presetName.trim() : null }
				})
			);
			this.step = 2;
			await this.dryRun();
		} catch (e) {
			toast.error(e, 'Не удалось сохранить сопоставление');
		} finally {
			this.busy = false;
		}
	}

	// --- шаг 3: проверка -----------------------------------------------------------------------

	/** Проверка выполняется на сервере синхронно: пока идёт, показываем загрузку. */
	async dryRun(): Promise<void> {
		if (!this.job) return;
		this.error = null;
		this.busy = true;
		try {
			this.job = await unwrap(api.POST('/api/imports/{job_id}/dry-run', { params: { path: { job_id: this.job.id } } }));
			// сводка — дополнение к плиткам: не получилась, остаются плитки и список строк
			this.summary = await loadImportSummary(this.job.id).catch(() => null);
		} catch (e) {
			this.error = e;
		} finally {
			this.busy = false;
		}
	}

	// --- шаг 4–5: применение и откат --------------------------------------------------------------

	async apply(): Promise<void> {
		if (!this.job || this.busy) return;
		this.busy = true;
		try {
			this.job = await unwrap(api.POST('/api/imports/{job_id}/apply', { params: { path: { job_id: this.job.id } } }));
			this.step = 3;
			this.poller.start();
		} catch (e) {
			toast.error(e, 'Не удалось применить импорт');
		} finally {
			this.busy = false;
		}
	}

	async rollback(): Promise<void> {
		if (!this.job || this.busy) return;
		this.busy = true;
		try {
			this.job = await unwrap(api.POST('/api/imports/{job_id}/rollback', { params: { path: { job_id: this.job.id } } }));
			this.poller.start();
		} catch (e) {
			toast.error(e, 'Не удалось откатить импорт');
		} finally {
			this.busy = false;
		}
	}
}
