// Типы области CRM: алиасы схемы бэкенда (`$lib/api/schema.d.ts`) и локальные структуры.
import type { components } from '$lib/api';

type S = components['schemas'];

export type Deal = S['DealOut'];
/** строка `GET /api/deals`: сделка + продукты с направлениями и название статуса */
export type DealListItem = S['DealListItemOut'];
export type DealProductBrief = S['DealProductBriefOut'];
export type DealCard = S['DealCardOut'];
export type DealProduct = S['DealProductOut'];
export type DealCreate = S['DealCreateRequest'];
export type DealHistory = S['DealHistoryResponse'];
export type DealStages = S['StageSummaryOut'];
export type StageItem = S['StageItemOut'];
export type DealStatusChange = S['DealStatusHistoryOut'];
export type DealEvent = S['DealEventOut'];
export type Participant = S['ParticipantOut'];
export type Comment = S['CommentOut'];
export type Task = S['TaskOut'];
export type Organization = S['OrganizationOut'];
export type Branch = S['BranchOut'];
export type Contact = S['ContactOut'];
export type ContactChannel = S['ContactChannelOut'];
export type LearnerProfile = S['LearnerProfileOut'];
export type LearnerProfileReveal = S['LearnerProfileRevealOut'];
export type ContactProduct = S['ContactProductOut'];
export type Attachment = S['AttachmentOut'];
export type FileInfo = S['FileOut'];
export type NotificationItem = S['NotificationOut'];
export type NotificationPref = S['NotificationPrefOut'];

export type Workflow = S['WorkflowOut'];
export type WorkflowGraph = S['GraphOut'];
export type WorkflowStatus = S['StatusOut'];
export type WorkflowTransition = S['TransitionOut'];
export type AvailableTransition = S['AvailableTransitionOut'];

export type CustomFieldDef = S['CustomFieldDefOut'];
export type Region = S['RegionOut'];
export type Product = S['ProductOut'];
export type Direction = S['DirectionOut'];
export type LossReason = S['LossReasonOut'];

export type OrgSuggestion = S['OrgSuggestionOut'];
export type OrgDetails = S['OrgDetailsOut'];
export type DuplicateCandidate = S['DuplicateCandidateOut'];
export type OrganizationLicense = S['OrganizationLicenseOut'];

/** Роли из `/api/me → role`. */
export type Role = 'KAM' | 'HEAD' | 'ADMIN' | 'AUDITOR' | 'INTEGRATION';

export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type DealType = 'b2b' | 'b2c';
