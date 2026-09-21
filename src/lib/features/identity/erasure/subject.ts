// Субъект запроса на удаление ПДн (сотрудник, контакт или ИП): подпись и ссылка на его карточку.
// Бэкенд отдаёт только `subject_type` + `subject_id`, поэтому имена догружаются пачкой и кэшируются.
import { people } from '$lib/api/people.svelte';
import { contactCache, contactLabel, orgCache, orgLabel } from '$lib/features/crm/shared/entityCache.svelte';

export interface SubjectRef {
	subject_type: string;
	subject_id: string;
}

export function ensureSubjects(items: SubjectRef[]): void {
	people.ensure(items.filter((i) => i.subject_type === 'user').map((i) => i.subject_id));
	contactCache.ensure(items.filter((i) => i.subject_type === 'contact').map((i) => i.subject_id));
	orgCache.ensure(items.filter((i) => i.subject_type === 'organization').map((i) => i.subject_id));
}

/** Имя субъекта; пока грузится — «…» / короткий id. */
export function subjectName(type: string, id: string): string {
	if (type === 'user') return people.name(id);
	if (type === 'contact') return contactLabel(id) || '—';
	return orgLabel(id) || '—';
}

export function subjectHref(type: string, id: string): string {
	if (type === 'user') return `/admin/users/${id}`;
	if (type === 'contact') return `/contacts/${id}`;
	return `/organizations/${id}`;
}
