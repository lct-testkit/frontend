// Вызовы реестра инцидентов: каждый шаг процедуры — отдельный запрос с `If-Match` (версия карточки), ответ — обновлённая карточка.
import { api, ifMatch, unwrap, type components } from '$lib/api';
import type { Incident, IncidentStage } from './incidents';

type Path = (id: string) => { params: { path: { incident_id: string } } };
const path: Path = (id) => ({ params: { path: { incident_id: id } } });

export type IncidentPatch = components['schemas']['IncidentPatchRequest'];
export type IncidentConfirm = components['schemas']['IncidentConfirmRequest'];
export type RknNotice = components['schemas']['IncidentRknNoticeOut'];

export const loadIncident = (id: string, signal?: AbortSignal): Promise<Incident> => unwrap(api.GET('/api/admin/incidents/{incident_id}', { ...path(id), signal }));

export const patchIncident = (inc: Incident, body: IncidentPatch): Promise<Incident> =>
	unwrap(api.PATCH('/api/admin/incidents/{incident_id}', { ...path(inc.id), body, headers: ifMatch(inc.version) }));

export const confirmIncident = (inc: Incident, body: IncidentConfirm): Promise<Incident> =>
	unwrap(api.POST('/api/admin/incidents/{incident_id}/confirm', { ...path(inc.id), body, headers: ifMatch(inc.version) }));

export const closeIncident = (inc: Incident, reason: string | null): Promise<Incident> =>
	unwrap(api.POST('/api/admin/incidents/{incident_id}/close', { ...path(inc.id), body: { reason }, headers: ifMatch(inc.version) }));

/** Текст уведомления РКН (PDF и поля формы портала); можно формировать повторно. */
export const generateRknNotice = (id: string, stage: IncidentStage): Promise<RknNotice> =>
	unwrap(api.POST('/api/admin/incidents/{incident_id}/rkn-notice/{stage}', { params: { path: { incident_id: id, stage } } }));

export const markRknSent = (inc: Incident, stage: IncidentStage, reference: string, sentAt: string | null): Promise<Incident> =>
	unwrap(
		api.POST('/api/admin/incidents/{incident_id}/rkn-notice/{stage}/sent', {
			params: { path: { incident_id: inc.id, stage } },
			body: { reference, sent_at: sentAt },
			headers: ifMatch(inc.version)
		})
	);

export const generateSubjectsNotice = (id: string) => unwrap(api.POST('/api/admin/incidents/{incident_id}/subjects-notice', path(id)));

/** Ссылка на PDF (живёт несколько минут): файл привязан к инциденту. */
export async function noticeFileUrl(incidentId: string, fileId: string): Promise<string> {
	const res = await unwrap(api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: fileId }, query: { entity_type: 'security_incident', entity_id: incidentId } } }));
	return res.download_url;
}
