// sha256 в браузере (WebCrypto): сверка файла с `document_hash` без загрузки на сервер
// и хэш текста политики ПДн для `system_settings.pdn_policy`.

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
	const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
	// Копия в новый ArrayBuffer: TS 5.9/6 различает ArrayBuffer и SharedArrayBuffer у Uint8Array.
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	const copy = new Uint8Array(view.byteLength);
	copy.set(view);
	const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
	return toHex(digest);
}

export async function sha256HexOfBlob(blob: Blob): Promise<string> {
	return sha256Hex(await blob.arrayBuffer());
}

export const hashesEqual = (a: string | null | undefined, b: string | null | undefined): boolean =>
	!!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export const isSha256Hex = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value.trim());
