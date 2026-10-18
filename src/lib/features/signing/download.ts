// Сохранить уже загруженные байты как файл (подписанный документ, протокол): объектная ссылка и скрытый <a download>.
export function saveBytes(bytes: ArrayBuffer, filename: string, type = 'application/pdf'): void {
	const url = URL.createObjectURL(new Blob([bytes], { type }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
