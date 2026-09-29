// Вызовы модуля ПЭП. Публичные (`/public/*`, без входа) и внутренние (`/api/*`) адаптеры подписи имеют одну форму,
// поэтому экран подписи (`SignFlow`) один для гостя-контрагента и для сотрудника.
import { api, unwrap, idem } from '$lib/api';
import type {
	ChallengeInfo,
	SignatureCreate,
	SignatureDocument,
	SignatureOut,
	SignatureRequest,
	SignatureTemplate,
	SigningPage,
	VerifyResult
} from './types';

export interface SignAdapter {
	/** открытие страницы = ознакомление (сервер ставит `viewed`) */
	load(): Promise<SigningPage>;
	challenge(): Promise<ChallengeInfo>;
	sign(otp: string): Promise<SignatureOut>;
	reject(reason: string): Promise<void>;
}

/** Внешний подписант: токен из ссылки, сессии нет. */
export function publicAdapter(token: string): SignAdapter {
	const params = { path: { token } };
	return {
		load: () => unwrap(api.GET('/public/sign/{token}', { params })),
		challenge: () => unwrap(api.POST('/public/sign/{token}/challenge', { params })),
		sign: (otp) => unwrap(api.POST('/public/sign/{token}/sign', { params, body: { otp } })),
		reject: async (reason) => {
			await unwrap(api.POST('/public/sign/{token}/reject', { params, body: { reason } }));
		}
	};
}

/** Внутренний подписант (сотрудник): запрос подписи по id, вход выполнен. */
export function internalAdapter(requestId: string): SignAdapter {
	const params = { path: { request_id: requestId } };
	return {
		load: () => unwrap(api.POST('/api/signature-requests/{request_id}/view', { params })),
		challenge: () => unwrap(api.POST('/api/signature-requests/{request_id}/challenge', { params })),
		sign: (otp) => unwrap(api.POST('/api/signature-requests/{request_id}/sign', { params, body: { otp } })),
		reject: async (reason) => {
			await unwrap(api.POST('/api/signature-requests/{request_id}/reject', { params, body: { reason } }));
		}
	};
}

export const getDocument = (id: string): Promise<SignatureDocument> =>
	unwrap(api.GET('/api/signature-documents/{document_id}', { params: { path: { document_id: id } } }));

/**
 * Пачка карточек по id — один запрос вместо N (C-5). Недоступные/не найденные id бэкенд сам не
 * включает в ответ (тихо, не 404 на весь запрос) — вызывающая сторона (`known.ts`) не отличает
 * это от «пока не долетело». До 100 id за раз (лимит бэкенда, `_MAX_BATCH_IDS`); разбивку на
 * несколько запросов при большем количестве делает `known.ts`, здесь — ровно один HTTP-вызов.
 */
export const getDocumentsBatch = (ids: string[]): Promise<SignatureDocument[]> =>
	unwrap(api.GET('/api/signature-documents/batch', { params: { query: { ids: ids.join(',') } } })).then(
		(page) => page.items
	);

/** История документов сущности (сделки): включая аннулированные, отклонённые и просроченные. */
export async function listDocuments(entityType: 'deal' | 'erasure_request' | 'report_job', entityId: string, limit = 50): Promise<SignatureDocument[]> {
	const page = await unwrap(api.GET('/api/signature-documents', { params: { query: { entity_type: entityType, entity_id: entityId, limit } } }));
	return page.items;
}

export const createDocument = (body: SignatureCreate): Promise<SignatureDocument> =>
	unwrap(api.POST('/api/signature-documents', { body, headers: idem() }));

export const sendDocument = (id: string): Promise<SignatureDocument> =>
	unwrap(api.POST('/api/signature-documents/{document_id}/send', { params: { path: { document_id: id } } }));

export const voidDocument = (id: string, reason: string): Promise<SignatureDocument> =>
	unwrap(api.POST('/api/signature-documents/{document_id}/void', { params: { path: { document_id: id } }, body: { reason } }));

/** Новая `sign_url` внешнему подписанту, пока его запрос ждёт подписи (`sent`/`viewed`); прежняя ссылка перестаёт работать.
 * Нужна, когда очередь дошла до подписанта после подписи предыдущего, а ссылку никто не выдал (backend-issues C-7). */
export const reissueLink = (requestId: string): Promise<SignatureRequest> =>
	unwrap(api.POST('/api/signature-requests/{request_id}/reissue-link', { params: { path: { request_id: requestId } } }));

export async function protocolLink(id: string): Promise<string> {
	const out = await unwrap(api.GET('/api/signature-documents/{document_id}/protocol', { params: { path: { document_id: id } } }));
	return out.download_url;
}

/** Штампованная копия документа (`signed_file_id`) — единственный файл, который реально проверяет
 * «Найти подпись по файлу» (`verify_by_file` сверяет его хэш наравне с оригиналом). Протокол
 * (`protocolLink` выше) для этого не годится — это отдельный сгенерированный PDF, не подписанный
 * артефакт, и раньше был единственной кнопкой скачивания на этой странице (backend-issues). */
export async function signedContainerLink(doc: SignatureDocument): Promise<string> {
	if (!doc.signed_file_id) throw new Error('У документа нет штампованной копии');
	const out = await unwrap(
		api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: doc.signed_file_id }, query: { entity_type: doc.entity_type, entity_id: doc.entity_id } } })
	);
	return out.download_url;
}

export async function listTemplates(): Promise<SignatureTemplate[]> {
	return (await unwrap(api.GET('/api/signature-templates'))).items;
}

export const myRequests = () => unwrap(api.GET('/api/me/signature-requests'));

export const verifyById = (id: string): Promise<VerifyResult> =>
	unwrap(api.GET('/public/verify/{signature_id}', { params: { path: { signature_id: id } } }));

/** Поиск подписи по файлу (нужен вход): multipart, поэтому без JSON-сериализации. */
export async function verifyByFile(file: File): Promise<VerifyResult> {
	const form = new FormData();
	form.append('file', file);
	return unwrap(api.POST('/api/signatures/verify', { body: form as never, bodySerializer: (b) => b as never }));
}
