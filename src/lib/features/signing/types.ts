// Локальные алиасы модуля ПЭП. Значения — из backend/app/modules/signing/models.py
// (CheckConstraint'ы), поэтому они стабильнее сгенерированной схемы; после появления
// `$lib/api/schema` типы ответов берём оттуда, а эти юнионы остаются для логики.
import type { components } from '$lib/api';

type Schemas = components['schemas'];
export type SigningPage = Schemas['SigningPageOut'];
export type SigningSigner = Schemas['SigningSignerPreview'];
export type ChallengeInfo = Schemas['ChallengeResponse'];
export type SignatureOut = Schemas['SignatureOut'];
export type SignatureDocument = Schemas['SignatureDocumentOut'];
export type SignatureRequest = Schemas['SignatureRequestOut'];
export type SignatureTemplate = Schemas['SignatureTemplateOut'];
export type SignatureCreate = Schemas['SignatureDocumentCreateRequest'];
export type SignerSpec = Schemas['SignerSpec'];
export type VerifyResult = Schemas['VerifyResult'];
export type EdmAgreement = Schemas['EdmAgreementOut'];
export type EdmAgreementCreate = Schemas['EdmAgreementCreateRequest'];

export type DocumentStatus =
	| 'draft'
	| 'pending'
	| 'partially_signed'
	| 'signed'
	| 'rejected'
	| 'expired'
	| 'void'
	| 'blocked_no_agreement';

export type RequestStatus =
	| 'pending'
	| 'sent'
	| 'viewed'
	| 'signed'
	| 'rejected'
	| 'expired'
	| 'locked'
	| 'void';

export type SignerType = 'internal' | 'external';
export type SigningOrder = 'sequential' | 'parallel';
export type DocType = 'kp' | 'act' | 'consent' | 'erasure_act' | 'offer' | 'custom';
export type VerifyStatus = 'valid' | 'disputed' | 'void' | 'hash_mismatch' | 'not_found';
export type OtpChannel = 'sms' | 'email' | 'telegram';
export type EdmPartyType = 'organization' | 'contact' | 'user';
export type EdmConclusionMethod = 'paper' | 'ukep' | 'offer_acceptance' | 'employment';
export type EdmStatus = 'active' | 'expired' | 'revoked';

/** Цветовая тональность для чипов/бейджей; в StatusChip общего слоя маппится на токены темы. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface StatusMeta {
	label: string;
	tone: Tone;
}

/** Минимум, который нужен логике подписантов (SigningSignerPreview и SignatureRequestOut подходят оба). */
export interface SignerLike {
	sign_order: number;
	status: RequestStatus | string;
	name?: string;
	is_me?: boolean;
}

/** Ссылка на страницу подписи для внешнего подписанта (показывается один раз). */
export interface SignLink {
	name: string;
	url: string;
}
