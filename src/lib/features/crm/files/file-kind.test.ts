import { describe, expect, it } from 'vitest';
import { fileKind } from './file-kind';

describe('fileKind', () => {
	it('узнаёт тип по MIME', () => {
		expect(fileKind('application/pdf')).toBe('PDF');
		expect(fileKind('image/png')).toBe('Изображение');
		expect(fileKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Word');
	});

	it('при неизвестном MIME берёт расширение имени', () => {
		expect(fileKind('application/octet-stream', 'отчёт.7z')).toBe('7Z');
		expect(fileKind(undefined, 'без-расширения')).toBe('Файл');
	});
});
