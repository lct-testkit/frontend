// Привязка загруженного файла к сущности (`POST /api/attachments`). Сразу после commit файл может быть ещё на проверке
// (422 «Файл ещё не прошёл проверку») — тогда привязку повторяем с паузой, как в signing/send-draft.svelte.ts.
import { uuid } from '$lib/uuid';
import { api, idem, unwrap } from '$lib/api';
import { ApiError } from '$lib/api/errors';
import type { AttachmentCategory } from '$lib/api/upload';
import type { Attachment } from '../types';

export const LINK_ATTEMPTS = 6;
const LINK_PAUSE_MS = 2000;

export const isStillScanning = (e: unknown) => e instanceof ApiError && e.status === 422 && /не прошёл проверку/i.test(e.detail);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LinkParams {
	fileId: string;
	entityType: string;
	entityId: string;
	category: AttachmentCategory;
	description: string;
}

export async function linkAttachment(p: LinkParams, pause: number = LINK_PAUSE_MS): Promise<Attachment> {
	// один ключ на всю цепочку попыток: повтор после обрыва сети не создаёт второе вложение
	const key = uuid();
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await unwrap(
				api.POST('/api/attachments', {
					body: { file_id: p.fileId, entity_type: p.entityType, entity_id: p.entityId, category: p.category, description: p.description },
					headers: idem(key)
				})
			);
		} catch (e) {
			if (!isStillScanning(e) || attempt >= LINK_ATTEMPTS) throw e;
			await sleep(pause);
		}
	}
}
