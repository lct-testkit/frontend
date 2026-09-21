// Алиасы типов API области «Настройка и данные» (схема генерирует `pnpm gen:api`).
import type { components } from '$lib/api';

type S = components['schemas'];

export type Workflow = S['WorkflowOut'];
export type WorkflowGraph = S['GraphOut'];
export type StatusImpact = S['StatusImpactResponse'];
export type StatusArchiveResult = S['StatusArchiveResponse'];

export type Product = S['ProductOut'];
export type Direction = S['DirectionOut'];
export type LossReason = S['LossReasonOut'];
export type Holiday = S['HolidayOut'];
export type CustomFieldDef = S['CustomFieldDefOut'];
export type Region = S['RegionOut'];

export type ImportJob = S['ImportJobOut'];
export type ImportPreset = S['ImportPresetOut'];
export type ImportProfile = S['ImportProfileResponse'];

export type ReportTemplate = S['ReportTemplateOut'];
export type ReportJob = S['ReportJobOut'];
export type Dashboard = S['DashboardOut'];
export type DashboardWidget = S['DashboardWidgetOut'];

export type RegistryVersion = S['RegistryVersionOut'];

export type IntegrationSource = S['IntegrationSourceOut'];
export type OutboxEvent = S['OutboxEventOut'];
export type InboundMessage = S['InboundMessageOut'];
export type ExternalRef = S['ExternalRefOut'];

export type NotificationTemplate = S['NotificationTemplateOut'];

/** Ответ `GET /health/ready` (читается сырым `fetch`: при 503 тело тоже JSON). */
export interface HealthDependency {
	name: string;
	ok: boolean;
	latency_ms?: number | null;
	details?: Record<string, unknown> | null;
}
export interface HealthReport {
	status: 'ok' | 'degraded' | 'unavailable' | string;
	dependencies: HealthDependency[];
}
