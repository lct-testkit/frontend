// Скачивание вложения: ссылка живёт 5 минут, поэтому запрашивается по клику, а не при загрузке списка.
import { api, unwrap } from '$lib/api';
import { toast } from '$lib/ui';

export async function downloadFile(fileId: string, entityType: string, entityId: string): Promise<void> {
	try {
		const res = await unwrap(api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: fileId }, query: { entity_type: entityType, entity_id: entityId } } }));
		window.open(res.download_url, '_blank', 'noopener');
	} catch (e) {
		toast.error(e);
	}
}
