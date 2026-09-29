import { beforeEach, describe, expect, it, vi } from 'vitest';

// Тот же приём, что known.test.ts: `api.GET`/`api.POST` подменены на моки, `unwrap` разворачивает `{ data }`
// и бросает `{ error }` — как настоящий `unwrap` из `$lib/api/client.ts`.
const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({
	api: { GET: get, POST: post },
	unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
		const response = await request;
		if (response.error) throw new Error(String(response.error));
		return response.data;
	}
}));

const load = () => import('./api');

beforeEach(() => {
	get.mockReset();
	post.mockReset();
});

describe('signedContainerLink', () => {
	// Единственный файл на странице документа, который реально проходит «Найти подпись по
	// файлу» (verify_by_file на бэкенде сверяет content_hash оригинала и File.sha256
	// signed_file_id — protocol_file_id туда не входит, см. fix(signing) в этой сессии).
	it('запрашивает download-url по signed_file_id, со scope сущности документа', async () => {
		get.mockResolvedValue({ data: { download_url: 'https://s3.example/signed-abc.pdf?sig=1' } });
		const { signedContainerLink } = await load();
		const doc = { id: 'doc-1', signed_file_id: 'file-42', entity_type: 'deal', entity_id: 'deal-7' };

		const url = await signedContainerLink(doc as never);

		expect(url).toBe('https://s3.example/signed-abc.pdf?sig=1');
		expect(get).toHaveBeenCalledWith(
			'/api/files/{file_id}/download-url',
			expect.objectContaining({ params: { path: { file_id: 'file-42' }, query: { entity_type: 'deal', entity_id: 'deal-7' } } })
		);
	});

	it('без signed_file_id (документ ещё не подписан) не ходит на бэкенд, а сразу отказывает', async () => {
		const { signedContainerLink } = await load();
		const doc = { id: 'doc-1', signed_file_id: null, entity_type: 'deal', entity_id: 'deal-7' };

		await expect(signedContainerLink(doc as never)).rejects.toThrow();
		expect(get).not.toHaveBeenCalled();
	});
});

describe('reissueLink', () => {
	// Кнопка «Переиздать ссылку» в DocumentPanel.svelte вызывает именно этот эндпоинт по id запроса.
	it('дёргает POST /api/signature-requests/{request_id}/reissue-link с id запроса', async () => {
		post.mockResolvedValue({ data: { id: 'req-1', sign_url: 'https://crm.local/sign/tok-new' } });
		const { reissueLink } = await load();

		const result = await reissueLink('req-1');

		expect(result).toEqual({ id: 'req-1', sign_url: 'https://crm.local/sign/tok-new' });
		expect(post).toHaveBeenCalledWith('/api/signature-requests/{request_id}/reissue-link', expect.objectContaining({ params: { path: { request_id: 'req-1' } } }));
	});
});
