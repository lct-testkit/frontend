// Локальные алиасы модуля identity (значения — CheckConstraint'ы backend/app/modules/identity/models.py
// и admin/models.py). Типы ответов API — из `$lib/api/schema`, когда появится.

import type { components } from '$lib/api';

type Schemas = components['schemas'];
export type UserOut = Schemas['UserOut'];
export type UserCreate = Schemas['UserCreateRequest'];
export type UserCreated = Schemas['UserCreateResponse'];
export type TeamOut = Schemas['TeamOut'];
export type AuditEntry = Schemas['AuditEntryOut'];
export type ErasureDetail = Schemas['ErasureRequestDetail'];
export type ApprovalOut = Schemas['ApprovalOut'];
export type OffboardResult = Schemas['OffboardResponse'];

export type Role = 'KAM' | 'HEAD' | 'ADMIN' | 'AUDITOR' | 'INTEGRATION';
export type UserStatus = 'invited' | 'active' | 'blocked' | 'terminated' | 'anonymized';
export type ErasureStatus = 'pending' | 'blocked' | 'approved' | 'rejected' | 'completed';
export type ErasureMode = 'anonymize' | 'hard_delete';
export type ErasureSubjectType = 'user' | 'contact' | 'organization';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';
export type ApprovalOperation = 'user.create_admin' | 'user.erasure' | 'contact.erasure' | 'organization.erasure';
export type AuditResult = 'success' | 'denied' | 'error';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface StatusMeta {
	label: string;
	tone: Tone;
}

export interface ErasureBlocker {
	code: string;
	detail: string;
	count?: number;
	legal_basis?: string | null;
}

export interface OffboardItem {
	kind: string;
	count: number;
	supported?: boolean;
	details?: Record<string, unknown>[];
}

export interface ApprovalLike {
	id: string;
	operation: string;
	status: string;
	payload: Record<string, unknown>;
	requested_by: string;
	approved_by?: string | null;
	expires_at: string;
}
