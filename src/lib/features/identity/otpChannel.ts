// Куда уйдёт код подтверждения подписи (ПЭП): есть телефон — SMS, нет телефона, но есть почта — на почту, нет ничего — отправить некуда.
// Телефон показывается маской (`+7 *** **12`): полный номер на экране не нужен. Что почта и SMS настроены, клиент не знает (ручки возможностей нет),
// поэтому без явного `smtp`/`sms` текст ничего не обещает сверх известного.

export type OtpChannel = 'sms' | 'email' | 'none';

export interface OtpChannelInfo {
	channel: OtpChannel;
	tone: 'info' | 'warning';
	text: string;
}

export interface OtpChannelInput {
	phone?: string | null;
	email?: string | null;
	/** `true` — почта настроена, `false` — нет, `null`/нет — неизвестно */
	smtp?: boolean | null;
	/** `mock` — тестовый шлюз, `real` — настоящий, нет — неизвестно */
	sms?: 'mock' | 'real' | null;
	/** демо-режим сборки: SMS уходят на тестовый шлюз */
	demo?: boolean;
}

/** `+7 999 123-45-12` → `+7 *** **12`: код страны и две последние цифры. Слишком короткое значение скрывается целиком. */
export function maskPhone(value: string | null | undefined): string {
	const digits = (value ?? '').replace(/\D/g, '');
	if (digits.length < 4) return '***';
	const country = digits.length >= 11 ? digits[0] : '7';
	return `+${country} *** **${digits.slice(-2)}`;
}

const DEMO_NOTE = 'В демо SMS уходят на тестовый шлюз, код подставляется кнопкой на странице подписи.';

export function otpChannel(input: OtpChannelInput): OtpChannelInfo {
	const phone = input.phone?.trim();
	const email = input.email?.trim();
	if (phone) {
		const note = input.demo || input.sms === 'mock' ? ` ${DEMO_NOTE}` : '';
		return { channel: 'sms', tone: 'info', text: `Код придёт SMS на ${maskPhone(phone)}.${note}` };
	}
	if (email) {
		if (input.smtp === false) return { channel: 'email', tone: 'warning', text: `Код придёт на почту ${email}, но почта не настроена: подписать не получится. Укажите телефон.` };
		return { channel: 'email', tone: 'info', text: `Код придёт на почту ${email}: убедитесь, что почта работает. Надёжнее указать телефон.` };
	}
	return { channel: 'none', tone: 'warning', text: 'Код отправить некуда: укажите телефон.' };
}
