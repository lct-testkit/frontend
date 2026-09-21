// Состояние мастера импорта: файл → сопоставление → проверка → применение → готово. Задание живёт на сервере, поэтому мастер
// восстанавливается по `?job=<id>` (обновление страницы и «Назад» не теряют прогресс).
import { goto } from '$app/navigation';
import { api, unwrap, idem, errorMessage, ApiError } from '$lib/api';
import { uploadFile } from '$lib/api/upload';
import { toast } from '$lib/ui';
import type { ImportJob, ImportPreset, ImportProfile } from '../types';
import { createPoller } from '../shared/polling.svelte';
import {
	IMPORT_MAX_FILE_BYTES,
	applyPreset,
	checkMapping,
	importStep,
	isImportBusy,
	sourceFormatFromName,
	type ImportEntity,
	type ImportMode,
	type MappingCheck
} from './mapping';

export const WIZARD_STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Применение', 'Готово'] as const;

export class ImportFlow {
	step = $state(0);
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
	savePreset = $state(false);
	presetName = $state('');
	loading = $state(false);
	/** идёт запрос шага (сохранение маппинга, проверка, применение, откат) */
	busy = $state(false);
	error = $state<unknown>(null);
	#ctrl: AbortController | null = null;

	headers = $derived(this.profile?.headers ?? []);
	check = $derived<MappingCheck>(checkMapping(this.mapping, this.headers, this.entity));
	rollingBack = $derived(this.job?.status === 'rolling_back');

	poller = createPoller(async () => {
		if (!this.job) return false;
		const job = await unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: this.job.id } } }));
		this.job = job;
		if (isImportBusy(job.status)) return true;
		this.step = 4;
		return false;
	});

	stop(): void {
		this.poller.stop();
		this.#ctrl?.abort();
	}

	// --- восстановление по ссылке ----------------------------------------------------------

	async restore(jobId: string): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
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
		if (file && !sourceFormatFromName(file.name)) {
			this.fileError = 'Подходят файлы Excel (.xlsx, .xls) и CSV.';
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
			const saved = this.job.mapping && Object.keys(this.job.mapping).length ? this.job.mapping : profile.suggested_mapping;
			this.mapping = { ...saved };
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
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
		const preset = this.presets.find((p) => p.id === id);
		if (preset) this.mapping = applyPreset(this.mapping, preset.mapping, this.headers);
	}

	async saveMapping(): Promise<void> {
		if (!this.job || this.busy || !this.check.ok) return;
		this.busy = true;
		try {
			const mapping = Object.fromEntries(Object.entries(this.mapping).filter(([h, t]) => t && this.headers.includes(h)));
			this.job = await unwrap(
				api.PUT('/api/imports/{job_id}/mapping', {
					params: { path: { job_id: this.job.id } },
					body: { mapping, save_as_preset: this.savePreset && this.presetName.trim() ? this.presetName.trim() : null }
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
