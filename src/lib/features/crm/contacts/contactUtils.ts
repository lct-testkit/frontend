// Контакты: значения формы ↔ тела запросов. E-mail и телефон в ответах API всегда маскированы (`+7 (9**) ***-**-67`, `i***@…`),
// поэтому при правке шлём только то, что пользователь изменил, а маску не отправляем никогда.
import { ApiError, type components } from '$lib/api';
import type { Contact } from '../types';

type S = components['schemas'];

export interface ChannelValue {
	type: string;
	value: string;
	is_primary: boolean;
}

export interface ContactFormValues {
	last_name: string;
	first_name: string;
	middle_name: string;
	position: string;
	organization_id: string | null;
	email: string;
	phone: string;
	is_decision_maker: boolean;
	channels: ChannelValue[];
}

export const emptyContactForm = (organizationId: string | null = null): ContactFormValues => ({
	last_name: '',
	first_name: '',
	middle_name: '',
	position: '',
	organization_id: organizationId,
	email: '',
	phone: '',
	is_decision_maker: false,
	channels: []
});

export const formFromContact = (c: Contact): ContactFormValues => ({
	last_name: c.last_name,
	first_name: c.first_name,
	middle_name: c.middle_name ?? '',
	position: c.position ?? '',
	organization_id: c.organization_id ?? null,
	email: c.email ?? '',
	phone: c.phone ?? '',
	is_decision_maker: c.is_decision_maker,
	channels: []
});

const text = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);

export function toCreateBody(v: ContactFormValues): S['ContactCreateRequest'] {
	return {
		last_name: v.last_name.trim(),
		first_name: v.first_name.trim(),
		middle_name: text(v.middle_name),
		position: text(v.position),
		organization_id: v.organization_id ?? undefined,
		email: text(v.email),
		phone: text(v.phone),
		is_decision_maker: v.is_decision_maker,
		channels: v.channels
			.filter((c) => c.value.trim())
			.map((c) => ({ type: c.type as S['ContactChannelIn']['type'], value: c.value.trim(), is_primary: c.is_primary }))
	};
}

const PATCH_KEYS = ['last_name', 'first_name', 'middle_name', 'position', 'organization_id', 'email', 'phone', 'is_decision_maker'] as const;

export function toPatchBody(original: ContactFormValues, next: ContactFormValues): S['ContactUpdateRequest'] {
	const body: Record<string, unknown> = {};
	for (const key of PATCH_KEYS) {
		const a = original[key];
		const b = next[key];
		if (a === b) continue;
		if ((key === 'email' || key === 'phone') && typeof b === 'string' && b.includes('*')) continue;
		body[key] = typeof b === 'string' ? (b.trim() ? b.trim() : null) : b;
	}
	return body as S['ContactUpdateRequest'];
}

export const isMasked = (value: string | null | undefined): boolean => !!value && value.includes('*');

export function validateContact(v: ContactFormValues): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!v.last_name.trim()) errors.last_name = 'Введите фамилию';
	if (!v.first_name.trim()) errors.first_name = 'Введите имя';
	const email = v.email.trim();
	if (email && !isMasked(email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Проверьте адрес почты';
	const phone = v.phone.trim();
	if (phone && !isMasked(phone) && phone.replace(/\D/g, '').length < 10) errors.phone = 'Слишком короткий номер';
	return errors;
}

export interface DuplicateCandidate {
	/** `null` — контакт другого менеджера: карточка недоступна, сервер id не раскрывает */
	id: string | null;
	name?: string;
	accessible: boolean;
}

/**
 * Совпавшие записи из ответа `409 CRM-1301` (создание контакта или организации): «такой уже есть».
 * `null` — это не ответ о дубле; пустой список — дубль есть, но описать его нечем.
 */
export function duplicateCandidates(error: unknown): DuplicateCandidate[] | null {
	if (!(error instanceof ApiError) || error.code !== 'CRM-1301') return null;
	const raw = error.extra.candidates;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
		.map((c) => ({
			id: typeof c.id === 'string' ? c.id : null,
			name: typeof c.name === 'string' ? c.name : undefined,
			accessible: c.accessible === true && typeof c.id === 'string'
		}));
}
