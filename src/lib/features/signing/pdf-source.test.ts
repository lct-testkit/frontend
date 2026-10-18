import { describe, expect, it } from 'vitest';
import { pickPdfSource } from './pdf-source';

describe('pickPdfSource', () => {
	it('есть file_url — выбирается он (тот же origin, без ссылки на хранилище)', () => {
		expect(pickPdfSource({ file_url: '/public/sign/abc/file', preview_url: 'http://localhost:8333/x.pdf?X-Amz-Signature=1' })).toEqual({ kind: 'file_url' });
	});

	it('нет file_url (старый бэкенд) — запасной путь по preview_url', () => {
		expect(pickPdfSource({ preview_url: 'http://s3/x.pdf' })).toEqual({ kind: 'preview_url', url: 'http://s3/x.pdf' });
		expect(pickPdfSource({ file_url: null, preview_url: 'http://s3/x.pdf' })).toEqual({ kind: 'preview_url', url: 'http://s3/x.pdf' });
	});

	it('пустой или пробельный file_url — preview_url', () => {
		expect(pickPdfSource({ file_url: '', preview_url: 'http://s3/x.pdf' })).toEqual({ kind: 'preview_url', url: 'http://s3/x.pdf' });
		expect(pickPdfSource({ file_url: '   ', preview_url: 'http://s3/x.pdf' })).toEqual({ kind: 'preview_url', url: 'http://s3/x.pdf' });
	});
});
