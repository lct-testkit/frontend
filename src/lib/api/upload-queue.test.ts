import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { UploadQueue } from './upload-queue.svelte';
import type { UploadedFile, UploadOptions } from './upload';

const pdf = (name: string, size = 100) => new File([new Uint8Array(size)], name, { type: 'application/pdf' });
const uploaded = (id: string): UploadedFile => ({
	id,
	original_filename: 'x',
	mime_type: 'application/pdf',
	size_bytes: 1,
	status: 'clean',
	contains_pd: false,
	created_at: ''
});

function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
	return { promise, resolve, reject };
}

describe('UploadQueue', () => {
	it('два файла уходят по очереди, не одновременно', async () => {
		let active = 0;
		let maxActive = 0;
		const order: string[] = [];
		const upload = vi.fn(async (f: File) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			order.push(f.name);
			await Promise.resolve();
			active -= 1;
			return uploaded(f.name);
		});
		const q = new UploadQueue({ upload });
		q.add([pdf('a.pdf'), pdf('b.pdf')]);
		await q.start();
		expect(order).toEqual(['a.pdf', 'b.pdf']);
		expect(maxActive).toBe(1);
		expect(q.rows.map((r) => r.state)).toEqual(['done', 'done']);
	});

	it('файл неподходящего типа не загружается, получает ошибку и не повторяется', async () => {
		const upload = vi.fn();
		const q = new UploadQueue({ upload });
		const [row] = q.add([pdf('virus.exe')]);
		await q.start();
		expect(upload).not.toHaveBeenCalled();
		expect(row.state).toBe('error');
		expect(row.error).toContain('.exe');
		await q.retry(row.id);
		expect(upload).not.toHaveBeenCalled();
	});

	it('cancel во время загрузки даёт строку error без повторной загрузки', async () => {
		const d = deferred<UploadedFile>();
		const upload = vi.fn((_f: File, o: UploadOptions) => {
			o.signal?.addEventListener('abort', () => d.reject(new DOMException('Aborted', 'AbortError')));
			return d.promise;
		});
		const q = new UploadQueue({ upload });
		const [row] = q.add([pdf('a.pdf')]);
		const run = q.start();
		await Promise.resolve();
		expect(row.state).toBe('uploading');
		q.cancel(row.id);
		await run;
		expect(row.state).toBe('error');
		expect(row.error).toBe('Загрузка отменена');
		expect(upload).toHaveBeenCalledTimes(1);
	});

	it('retry после сбоя commit передаёт resumeFileId — upload-intent второй раз не вызывается', async () => {
		let calls = 0;
		const seen: Array<string | undefined> = [];
		const upload = vi.fn(async (_f: File, o: UploadOptions) => {
			calls += 1;
			seen.push(o.resumeFileId);
			if (calls === 1) {
				o.onStored?.('file-1');
				throw ApiError.network();
			}
			return uploaded('file-1');
		});
		const q = new UploadQueue({ upload });
		const [row] = q.add([pdf('a.pdf')]);
		await q.start();
		expect(row.state).toBe('error');
		expect(row.fileId).toBe('file-1');
		await q.retry(row.id);
		expect(seen).toEqual([undefined, 'file-1']);
		expect(row.state).toBe('done');
	});

	it('сбой привязки: повтор делает только привязку, файл повторно не грузится', async () => {
		const upload = vi.fn(async () => uploaded('f1'));
		let link = 0;
		const onUploaded = vi.fn(async () => {
			link += 1;
			if (link === 1) throw new ApiError({ status: 422, detail: 'Файл ещё не прошёл проверку' });
		});
		const q = new UploadQueue({ upload, onUploaded });
		const [row] = q.add([pdf('a.pdf')]);
		await q.start();
		expect(row.state).toBe('error');
		expect(row.error).toContain('проверку');
		await q.retry(row.id);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(onUploaded).toHaveBeenCalledTimes(2);
		expect(row.state).toBe('done');
	});

	it('remove убирает только свою строку; ошибки сервера переводятся по коду', async () => {
		const upload = vi.fn(async (f: File) => {
			if (f.name === 'b.pdf') throw new ApiError({ status: 422, code: 'CRM-1402', detail: 'too big' });
			return uploaded(f.name);
		});
		const q = new UploadQueue({ upload });
		const rows = q.add([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);
		await q.start();
		expect(rows[1].error).toBe('Файл слишком большой.');
		q.remove(rows[1].id);
		expect(q.rows.map((r) => r.file.name)).toEqual(['a.pdf', 'c.pdf']);
	});

	it('clearDone оставляет строки с ошибкой', async () => {
		const upload = vi.fn(async (f: File) => {
			if (f.name === 'b.pdf') throw ApiError.network();
			return uploaded(f.name);
		});
		const q = new UploadQueue({ upload });
		q.add([pdf('a.pdf'), pdf('b.pdf')]);
		await q.start();
		q.clearDone();
		expect(q.rows.map((r) => r.file.name)).toEqual(['b.pdf']);
	});
});
