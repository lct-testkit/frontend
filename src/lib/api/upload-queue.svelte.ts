// Очередь загрузки файлов: по одному за раз, прогресс, отмена, повтор. Общая для вкладки «Файлы», диалога перехода
// и истории статусов. Загрузка идёт тремя шагами (upload.ts); если объект уже лежит в хранилище, а commit или привязка
// упали, «Повторить» делает только недостающий шаг и не грузит файл заново.
import { errorMessage } from './errors';
import { uploadFile as defaultUpload, type UploadedFile, type UploadOptions } from './upload';
import { validateFile, type FilePolicy } from '$lib/files/policy';

export type QueueState = 'queued' | 'uploading' | 'done' | 'error';

export interface QueueRow<M = unknown> {
	id: number;
	file: File;
	state: QueueState;
	/** 0..1 */
	progress: number;
	error: string | null;
	/** файл уже в хранилище — повтор делает только commit */
	fileId: string | null;
	/** commit пройден — повтор делает только привязку */
	uploaded: UploadedFile | null;
	/** отклонён ещё на клиенте: повторять нечего, только убрать */
	rejected: boolean;
	/** произвольные данные вызывающего (категория и т. п.) */
	meta: M | undefined;
}

export interface QueueHandlers<M = unknown> {
	upload?: (file: File, options: UploadOptions) => Promise<UploadedFile>;
	/** дополнительные параметры загрузки для строки (категория и т. п.) */
	optionsFor?: (row: QueueRow<M>) => Pick<UploadOptions, 'category' | 'purpose'>;
	/** файл загружен и прошёл commit: привязать к сущности. Бросить исключение, чтобы строка осталась с ошибкой */
	onUploaded?: (row: QueueRow<M>, uploaded: UploadedFile) => Promise<void> | void;
	/** файл загружен и привязан (в том числе после «Повторить»); строку можно убрать из очереди */
	onDone?: (row: QueueRow<M>) => void;
	/** строку убрали (remove/clear), а файл уже загружен и не привязан — например, чтобы удалить сироту */
	onDiscard?: (row: QueueRow<M>) => void;
	/** текущая политика форматов; по умолчанию — из policy.ts */
	policy?: () => FilePolicy | undefined;
}

export class UploadQueue<M = unknown> {
	rows = $state<QueueRow<M>[]>([]);
	running = $state(false);

	#seq = 0;
	#aborters = new Map<number, AbortController>();
	#handlers: QueueHandlers<M>;

	constructor(handlers: QueueHandlers<M> = {}) {
		this.#handlers = handlers;
	}

	get busy() {
		return this.running || this.rows.some((r) => r.state === 'uploading');
	}
	get pendingCount() {
		return this.rows.filter((r) => r.state === 'queued').length;
	}
	get hasErrors() {
		return this.rows.some((r) => r.state === 'error');
	}

	/** Добавить файлы. Не подходящие по формату или размеру сразу получают ошибку и в загрузку не идут. */
	add(files: Iterable<File>, meta?: M): QueueRow<M>[] {
		const added: QueueRow<M>[] = [];
		for (const file of files) {
			const check = validateFile(file, this.#handlers.policy?.());
			this.rows.push({
				id: (this.#seq += 1),
				file,
				state: check.ok ? 'queued' : 'error',
				progress: 0,
				error: check.ok ? null : check.message,
				fileId: null,
				uploaded: null,
				rejected: !check.ok,
				meta
			});
			// добавляем в массив $state и берём проксированную строку, иначе изменения полей не видны интерфейсу
			added.push(this.rows[this.rows.length - 1]);
		}
		return added;
	}

	/** Загрузить всё, что в очереди, по одному файлу. Возвращает, когда очередь пройдена. */
	async start(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			for (;;) {
				const next = this.rows.find((r) => r.state === 'queued');
				if (!next) break;
				await this.#run(next);
			}
		} finally {
			this.running = false;
		}
	}

	/** Загрузить одну строку, минуя общую очередь (повтор). */
	async #run(row: QueueRow<M>) {
		const ctrl = new AbortController();
		this.#aborters.set(row.id, ctrl);
		row.state = 'uploading';
		row.error = null;
		try {
			let uploaded = row.uploaded;
			if (!uploaded) {
				row.progress = 0;
				uploaded = await (this.#handlers.upload ?? defaultUpload)(row.file, {
					...this.#handlers.optionsFor?.(row),
					signal: ctrl.signal,
					resumeFileId: row.fileId ?? undefined,
					onStored: (id) => (row.fileId = id),
					onProgress: (f) => (row.progress = f)
				});
				row.uploaded = uploaded;
				row.fileId = uploaded.id;
			}
			ctrl.signal.throwIfAborted();
			await this.#handlers.onUploaded?.(row, uploaded);
			row.state = 'done';
			row.progress = 1;
			this.#handlers.onDone?.(row);
		} catch (e) {
			row.state = 'error';
			row.error = e instanceof DOMException && e.name === 'AbortError' ? 'Загрузка отменена' : errorMessage(e);
		} finally {
			this.#aborters.delete(row.id);
		}
	}

	/** Прервать загрузку файла. Уже уложенный в хранилище объект остаётся — «Повторить» доделает commit. */
	cancel(id: number) {
		this.#aborters.get(id)?.abort();
	}

	/** Повторить строку с ошибкой с того шага, на котором она упала. */
	async retry(id: number): Promise<void> {
		const row = this.rows.find((r) => r.id === id);
		if (!row || row.rejected || row.state !== 'error') return;
		await this.#run(row);
	}

	remove(id: number) {
		this.#aborters.get(id)?.abort();
		const row = this.rows.find((r) => r.id === id);
		if (row?.fileId && row.state !== 'done') this.#handlers.onDiscard?.(row);
		this.rows = this.rows.filter((r) => r.id !== id);
	}

	clearDone() {
		this.rows = this.rows.filter((r) => r.state !== 'done');
	}

	clear() {
		for (const ctrl of this.#aborters.values()) ctrl.abort();
		for (const row of this.rows) if (row.fileId && row.state !== 'done') this.#handlers.onDiscard?.(row);
		this.rows = [];
	}
}
