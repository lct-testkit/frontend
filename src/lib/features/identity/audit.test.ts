import { describe, expect, it } from 'vitest';
import { entityLabel, ensureAuditEntities, fieldLabel, formatChanges, formatValue, labelFromChanges, shortId } from './audit';
import { ENTITY_TYPE_LABEL } from './labels';

describe('formatValue', () => {
	it('пустое, булево, числа, массивы, объекты', () => {
		expect(formatValue(null)).toBe('—');
		expect(formatValue(true)).toBe('Да');
		expect(formatValue(1250000)).toBe('1 250 000');
		expect(formatValue(['a', 'b'])).toBe('a, b');
		expect(formatValue({ x: 1 })).toBe('{"x":1}');
	});
});

describe('formatChanges', () => {
	it('разбирает {old,new}', () => {
		expect(formatChanges({ role: { old: 'KAM', new: 'HEAD' } })).toEqual([{ field: 'role', oldValue: 'KAM', newValue: 'HEAD', isFact: false }]);
	});
	it('разбирает [old,new] и факты', () => {
		expect(formatChanges({ status: ['active', 'blocked'], required: ['user:write'], reason: { old: null, new: 'отпуск' } })).toEqual([
			{ field: 'status', oldValue: 'active', newValue: 'blocked', isFact: false },
			{ field: 'required', oldValue: '—', newValue: 'user:write', isFact: true },
			{ field: 'reason', oldValue: '—', newValue: 'отпуск', isFact: true }
		]);
	});
	it('пусто', () => {
		expect(formatChanges(null)).toEqual([]);
	});
	it('подписи полей и короткий id', () => {
		expect(fieldLabel('sessions_terminated')).toBe('Сессий завершено');
		expect(fieldLabel('unknown_field')).toBe('unknown_field');
		expect(shortId('0192a1b2-3c4d-7e8f-9a0b-1c2d3e4f5a6b')).toBe('0192a1b2…5a6b');
		expect(shortId(null)).toBe('—');
	});
});

describe('entityLabel — колонка «Сущность» журнала аудита (раньше показывала только фрагмент id)', () => {
	it('без id — null; тип без клиентского кэша (файл, задача…) — тоже null: снаружи это короткий id, как и раньше', () => {
		expect(entityLabel('deal', null)).toBeNull();
		expect(entityLabel(null, 'x')).toBeNull();
		expect(entityLabel('file', 'file-1')).toBeNull();
		expect(entityLabel('task', 'task-1')).toBeNull();
	});
});

describe('ensureAuditEntities', () => {
	it('не падает на пустом списке и на типах без кэша — фильтры по типу просто не находят ни одной записи', () => {
		expect(() => ensureAuditEntities([])).not.toThrow();
		expect(() => ensureAuditEntities([{ entity_type: 'file', entity_id: 'f-1' }])).not.toThrow();
	});
});

// Типы `entity_type`, которые бэкенд пишет в журнал (18.10.2026). Обновлять командой из корня репозитория:
//   grep -rhoE 'entity_type = "[a-z_]+"' backend/app (см. план F3-12)
export const BACKEND_AUDIT_ENTITY_TYPES = [
	'admin_approval', 'audit_log', 'consent', 'contact', 'custom_field_def', 'dashboard', 'data_erasure_request', 'deal', 'deal_comment', 'direction',
	'edm_agreement', 'erasure_request', 'feature_flag', 'file', 'holiday', 'import_job', 'import_preset', 'integration_source', 'learner', 'loss_reason',
	'notification_template', 'organization', 'organization_license', 'outbox_event', 'payment', 'product', 'registry_version', 'report_job', 'retention_run',
	'security_event', 'signature_document', 'signature_request', 'status_mapping_job', 'system_setting', 'task', 'team', 'user', 'vendor_contact', 'workflow', 'workflow_status'
];

describe('подписи типов сущностей', () => {
	it('для каждого типа, который пишет бэкенд, есть подпись (фильтр «Сущность» и колонка не показывают сырой код)', () => {
		expect(BACKEND_AUDIT_ENTITY_TYPES.filter((t) => !ENTITY_TYPE_LABEL[t])).toEqual([]);
	});
});

describe('labelFromChanges — имя из самой записи', () => {
	it('создание — новое значение, удаление — старое', () => {
		expect(labelFromChanges({ action: 'PRODUCT_CREATED', changes: { code: { old: null, new: 'PY-BASE' } } })).toBe('PY-BASE');
		expect(labelFromChanges({ action: 'PRODUCT_DELETED', changes: { code: { old: 'PY-BASE', new: null } } })).toBe('PY-BASE');
		expect(labelFromChanges({ action: 'X_DELETED', changes: { name: ['Старое', 'Новое'] } })).toBe('Старое');
		expect(labelFromChanges({ action: 'X_UPDATED', changes: { name: ['Старое', 'Новое'] } })).toBe('Новое');
	});
	it('приоритет: name раньше code; праздник — по дате', () => {
		expect(labelFromChanges({ changes: { code: 'a', name: 'Название' } })).toBe('Название');
		expect(labelFromChanges({ action: 'HOLIDAY_CREATED', changes: { date: '2026-11-04' } })).toBe('2026-11-04');
	});
	it('нет подходящих полей — null', () => {
		expect(labelFromChanges({ changes: { reason: 'x' } })).toBeNull();
		expect(labelFromChanges(null)).toBeNull();
	});
});

describe('entityLabel — запасной путь', () => {
	it('тип без резолвера берёт имя из changes, неизвестный id без changes — null', () => {
		expect(entityLabel('holiday', 'h1', { action: 'HOLIDAY_CREATED', changes: { date: '2026-11-04' } })).toBe('2026-11-04');
		expect(entityLabel('holiday', 'h1', { changes: null })).toBeNull();
		expect(entityLabel('product', 'p-unknown')).toBeNull();
	});
});
