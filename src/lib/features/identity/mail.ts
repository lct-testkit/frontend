// Что известно о письме сотруднику или подписанту: отправлено, в очереди, не отправлено — и почему. «Отправлено» значит «почтовый сервер принял письмо»,
// а не «получатель прочитал». Причину бэкенд пока отдаёт не везде: без неё текст не гадает.

export type MailStatus = 'sent' | 'queued' | 'not_sent';
export type MailReason = 'smtp_missing' | 'keycloak_smtp_missing' | 'no_address' | 'send_failed';

const STATUS_LABELS: Record<MailStatus, string> = { sent: 'Письмо передано почтовому серверу', queued: 'Письмо в очереди', not_sent: 'Письмо не отправлено' };
const REASON_TEXT: Record<MailReason, string> = {
	smtp_missing: 'почта не настроена на сервере',
	keycloak_smtp_missing: 'в Keycloak не настроена почта',
	no_address: 'у получателя не указан адрес',
	send_failed: 'почтовый сервер не принял письмо'
};

export const mailLabel = (status: MailStatus): string => STATUS_LABELS[status];

/** Полная фраза: «Письмо не отправлено: почта не настроена на сервере». Неизвестная причина показывается как есть, без причины — просто статус. */
export function mailText(status: MailStatus, reason?: string | null): string {
	const base = STATUS_LABELS[status];
	if (status !== 'not_sent' || !reason) return base;
	return `${base}: ${REASON_TEXT[reason as MailReason] ?? reason}`;
}

export const mailTone = (status: MailStatus): 'success' | 'neutral' | 'warning' => (status === 'sent' ? 'success' : status === 'queued' ? 'neutral' : 'warning');

/** Из флага `invite_email_sent` ответа на создание или повторную выдачу приглашения. */
export const inviteMailStatus = (sent: boolean | null | undefined): MailStatus => (sent ? 'sent' : 'not_sent');
