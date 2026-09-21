// File upload never goes through the API worker (new_spec §3.7):
//   1. POST /api/files/upload-intent  → presigned PUT url
//   2. PUT  <url> (straight to S3/SeaweedFS, progress via XHR)
//   3. POST /api/files/{id}/commit    → server verifies object, size and sha256, queues antivirus
import { api, unwrap, idem } from './client';
import { ApiError } from './errors';

export type AttachmentCategory = 'contract' | 'presentation' | 'act' | 'license' | 'report' | 'signature_container' | 'other';

export interface UploadOptions {
	purpose?: string;
	category?: AttachmentCategory;
	onProgress?: (fraction: number) => void;
	signal?: AbortSignal;
}

export interface UploadedFile {
	id: string;
	original_filename: string;
	mime_type: string;
	size_bytes: number;
	sha256?: string | null;
	status: string;
	contains_pd: boolean;
	created_at: string;
}

const HASH_LIMIT = 32 * 1024 * 1024;

async function sha256Hex(file: Blob): Promise<string | undefined> {
	if (file.size > HASH_LIMIT || !crypto.subtle) return undefined;
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function put(url: string, file: Blob, headers: Record<string, string>, onProgress?: (f: number) => void, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
		xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new ApiError({ status: xhr.status, detail: 'Не удалось загрузить файл в хранилище.' }));
		xhr.onerror = () => reject(ApiError.network());
		xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
		signal?.addEventListener('abort', () => xhr.abort(), { once: true });
		xhr.send(file);
	});
}

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadedFile> {
	const key = crypto.randomUUID();
	const intent = await unwrap(
		api.POST('/api/files/upload-intent', {
			body: {
				filename: file.name,
				size_bytes: file.size,
				mime_type: file.type || 'application/octet-stream',
				purpose: options.purpose ?? null,
				category: options.category ?? null
			},
			headers: idem(key)
		})
	);
	await put(intent.upload_url, file, intent.upload_headers ?? {}, options.onProgress, options.signal);
	options.onProgress?.(1);
	const sha256 = await sha256Hex(file);
	return (await unwrap(
		api.POST('/api/files/{file_id}/commit', {
			params: { path: { file_id: intent.file_id } },
			body: { sha256: sha256 ?? null }
		})
	)) as UploadedFile;
}
