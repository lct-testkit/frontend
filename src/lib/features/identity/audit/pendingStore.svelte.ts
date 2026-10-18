// Ожидающие запечатывания события, как их видит журнал аудита: пишет список, читает страница (текст подтверждения выгрузки).
import type { Pending } from './pending';

export const auditPending = $state<{ value: Pending | null }>({ value: null });
