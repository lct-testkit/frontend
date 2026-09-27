// Пометки контакта (ЛПР, «Обезличен») и что они значат: подсказка над плашкой в списке и в карточке. Значения берутся из полей контакта
// `is_decision_maker` и `is_anonymized` (backend catalog/models.py) — других пометок у контакта нет.
import type { Contact } from '../types';

export interface ContactMark {
	label: string;
	tone: 'info' | 'neutral';
	/** что это значит, простыми словами */
	hint: string;
}

export const DECISION_MAKER_MARK: ContactMark = {
	label: 'ЛПР',
	tone: 'info',
	hint: 'Лицо, принимающее решения в организации. В документах указывается как «ЛПР организации».'
};

export const ANONYMIZED_MARK: ContactMark = {
	label: 'Обезличен',
	tone: 'neutral',
	hint: 'Имя, телефон, e-mail и данные учащегося удалены без возврата. Карточка осталась ради истории сделок.'
};

/** Пометка контакта для плашки: обезличенный важнее ЛПР (у него личных данных уже нет), у обычного контакта пометки нет. */
export function contactMark(contact: Pick<Contact, 'is_anonymized' | 'is_decision_maker'>): ContactMark | null {
	if (contact.is_anonymized) return ANONYMIZED_MARK;
	if (contact.is_decision_maker) return DECISION_MAKER_MARK;
	return null;
}
