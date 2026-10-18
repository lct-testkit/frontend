// Каналы уведомлений и что из них реально работает. Telegram у бэкенда без шлюза: доставка получает статус «пропущено», привязки чата у сотрудника нет.
// Почта работает только при настроенном SMTP; пока возможности сервера неизвестны, про почту ничего не утверждаем.

export type Channel = 'in_app' | 'email' | 'telegram';
export const CHANNELS: readonly Channel[] = ['in_app', 'email', 'telegram'];

/** Возможности сервера, если они известны: `true` — работает, `false` — нет, `null`/нет поля — неизвестно. */
export interface Capabilities {
	smtp?: boolean | null;
	telegram?: boolean | null;
}

export interface ChannelState {
	available: boolean | 'unknown';
	/** подпись канала с пометкой, если нужна */
	label: string;
	/** пояснение к пометке (подсказка у флажка) или `null` */
	note: string | null;
}

const NAMES: Record<Channel, string> = { in_app: 'В приложении', email: 'E-mail', telegram: 'Telegram' };

export function channelState(channel: Channel, caps?: Capabilities | null): ChannelState {
	if (channel === 'in_app') return { available: true, label: NAMES.in_app, note: null };
	if (channel === 'telegram') {
		if (caps?.telegram === true) return { available: true, label: NAMES.telegram, note: null };
		return { available: false, label: `${NAMES.telegram} (не подключён)`, note: 'Telegram в этой сборке не подключён: сообщения в него не отправляются.' };
	}
	if (caps?.smtp === true) return { available: true, label: NAMES.email, note: null };
	if (caps?.smtp === false) return { available: false, label: `${NAMES.email} (почта не настроена)`, note: 'Почтовый сервер не настроен: письма не уходят. Выбор сохранится и заработает после настройки.' };
	return { available: 'unknown', label: NAMES.email, note: 'Письма уходят, если администратор настроил почтовый сервер.' };
}

/** Можно ли поставить флажок: недоступный канал нельзя включить, но уже включённый можно выключить. Почта остаётся выбираемой, чтобы настройки не пропали. */
export function canToggle(channel: Channel, checked: boolean, caps?: Capabilities | null): boolean {
	const s = channelState(channel, caps);
	if (channel === 'email') return true;
	return s.available === true || checked;
}

/** Каналы строки как есть — включая недоступные: сохранённый выбор не теряется при сохранении. */
export function visibleChannels(row: { channels: readonly string[] }): string[] {
	return [...row.channels];
}
