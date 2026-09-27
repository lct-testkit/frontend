// Короткая подпись типа файла для списка вложений: по MIME, а если он общий (octet-stream) — по расширению имени.
const BY_MIME: Record<string, string> = {
	'application/pdf': 'PDF',
	'application/zip': 'ZIP',
	'application/x-zip-compressed': 'ZIP',
	'application/gzip': 'GZ',
	'application/x-rar-compressed': 'RAR',
	'application/vnd.rar': 'RAR',
	'application/msword': 'Word',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
	'application/vnd.ms-excel': 'Excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
	'application/xml': 'XML',
	'text/xml': 'XML',
	'text/csv': 'CSV',
	'application/json': 'JSON'
};

export function fileKind(mime: string | null | undefined, filename?: string | null): string {
	if (mime && BY_MIME[mime]) return BY_MIME[mime];
	if (mime?.startsWith('image/')) return 'Изображение';
	const ext = filename?.includes('.') ? filename.split('.').pop()?.toUpperCase() : '';
	return ext || 'Файл';
}
