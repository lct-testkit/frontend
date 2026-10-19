/**
 * Копирование в буфер. `navigator.clipboard` есть только в безопасном контексте (HTTPS/localhost);
 * по обычному http на другом адресе запасной путь — скрытое поле и `execCommand('copy')`.
 */
export async function copyText(text: string): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && globalThis.isSecureContext !== false) {
		await navigator.clipboard.writeText(text);
		return;
	}
	const area = document.createElement('textarea');
	area.value = text;
	area.setAttribute('readonly', '');
	area.className = 'fixed -left-[9999px] top-0 opacity-0';
	document.body.appendChild(area);
	try {
		area.select();
		if (!document.execCommand('copy')) throw new Error('copy rejected');
	} finally {
		area.remove();
	}
}
