// sha256 для браузера: сверка файла с `document_hash` без загрузки на сервер, хэш текста политики
// ПДн (`ConsentGate`, `system_settings.pdn_policy`) и опциональная контрольная сумма загрузки
// (`api/upload.ts`).
//
// `crypto.subtle` (WebCrypto) есть только в безопасном контексте — HTTPS или `localhost` (сам
// localhost браузер считает безопасным особым исключением). На install.sh --tls off с публичным
// --host (RUNBOOK явно разрешает такой сценарий) страница открыта по голому HTTP на НЕ-localhost
// адресе — `crypto.subtle` отсутствует, и без фолбэка здесь падал `TypeError`, а согласие с
// политикой ПДн (обязательный экран, отказ = выход) невозможно было принять вообще ни при каких
// условиях. Хэш политики — не секрет, это просто контрольная сумма для сверки редакции с сервером
// (`policy_text_hash`, NOT NULL, ровно 64 hex-символа — backend/app/modules/identity/service.py
// `policy_text_hash()`), поэтому чистый JS вместо аппаратного WebCrypto тут не ослабляет
// безопасность. `sha256Fallback` — обычный SHA-256 (FIPS 180-4), сверен побайтно с `node:crypto`
// на пустой строке, "abc", юникоде и мегабайтном входе.
function sha256Fallback(bytes: Uint8Array): Uint8Array {
	// prettier-ignore
	const K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	]);
	const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

	let h0 = 0x6a09e667,
		h1 = 0xbb67ae85,
		h2 = 0x3c6ef372,
		h3 = 0xa54ff53a,
		h4 = 0x510e527f,
		h5 = 0x9b05688c,
		h6 = 0x1f83d9ab,
		h7 = 0x5be0cd19;

	const bitLen = bytes.length * 8;
	const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
	padded.set(bytes);
	padded[bytes.length] = 0x80;
	const view = new DataView(padded.buffer);
	view.setUint32(padded.length - 4, bitLen >>> 0, false);
	view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);

	const w = new Uint32Array(64);
	for (let off = 0; off < padded.length; off += 64) {
		for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
			const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
			w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
		}
		let a = h0,
			b = h1,
			c = h2,
			d = h3,
			e = h4,
			f = h5,
			g = h6,
			h = h7;
		for (let i = 0; i < 64; i++) {
			const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
			const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const t2 = (S0 + maj) >>> 0;
			h = g;
			g = f;
			f = e;
			e = (d + t1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (t1 + t2) >>> 0;
		}
		h0 = (h0 + a) >>> 0;
		h1 = (h1 + b) >>> 0;
		h2 = (h2 + c) >>> 0;
		h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0;
		h5 = (h5 + f) >>> 0;
		h6 = (h6 + g) >>> 0;
		h7 = (h7 + h) >>> 0;
	}

	const out = new Uint8Array(32);
	const outView = new DataView(out.buffer);
	[h0, h1, h2, h3, h4, h5, h6, h7].forEach((h, i) => outView.setUint32(i * 4, h, false));
	return out;
}

async function digestSha256(bytes: Uint8Array): Promise<Uint8Array> {
	if (globalThis.crypto?.subtle) {
		// Копия в новый ArrayBuffer: TS 5.9/6 различает ArrayBuffer и SharedArrayBuffer у Uint8Array.
		const copy = new Uint8Array(bytes.byteLength);
		copy.set(bytes);
		return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', copy));
	}
	return sha256Fallback(bytes);
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
	const bytes =
		typeof data === 'string'
			? new TextEncoder().encode(data)
			: data instanceof Uint8Array
				? data
				: new Uint8Array(data);
	return toHex(await digestSha256(bytes));
}

export async function sha256HexOfBlob(blob: Blob): Promise<string> {
	return sha256Hex(await blob.arrayBuffer());
}

export const hashesEqual = (a: string | null | undefined, b: string | null | undefined): boolean =>
	!!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export const isSha256Hex = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value.trim());
