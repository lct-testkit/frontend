import { describe, expect, it } from 'vitest';
import {
	attemptsLeft,
	attemptsWord,
	cooldownFromRetryAfter,
	formatCountdown,
	isOtpComplete,
	normalizeOtp,
	resendState,
	secondsUntil,
	sendsLeft
} from './otp';

describe('normalizeOtp', () => {
	it('оставляет только цифры и режет до 6', () => {
		expect(normalizeOtp('12 34-56')).toBe('123456');
		expect(normalizeOtp('1234567890')).toBe('123456');
		expect(normalizeOtp('abc')).toBe('');
	});
	it('isOtpComplete', () => {
		expect(isOtpComplete('12345')).toBe(false);
		expect(isOtpComplete('123456')).toBe(true);
	});
});

describe('resendState', () => {
	it('до первой отправки можно сразу', () => {
		expect(resendState(null, 1000)).toEqual({ canResend: true, secondsLeft: 0 });
	});
	it('считает остаток окна', () => {
		const sentAt = 100_000;
		expect(resendState(sentAt, sentAt + 1_000)).toEqual({ canResend: false, secondsLeft: 59 });
		expect(resendState(sentAt, sentAt + 59_500)).toEqual({ canResend: false, secondsLeft: 1 });
		expect(resendState(sentAt, sentAt + 60_000)).toEqual({ canResend: true, secondsLeft: 0 });
	});
	it('уважает Retry-After', () => {
		expect(resendState(0, 10_000, cooldownFromRetryAfter(30))).toEqual({ canResend: false, secondsLeft: 20 });
	});
});

describe('cooldownFromRetryAfter', () => {
	it('fallback на 60 при отсутствии/мусоре', () => {
		expect(cooldownFromRetryAfter(undefined)).toBe(60);
		expect(cooldownFromRetryAfter(0)).toBe(60);
		expect(cooldownFromRetryAfter(Number.NaN)).toBe(60);
	});
	it('округляет вверх и ограничивает часом', () => {
		expect(cooldownFromRetryAfter(12.2)).toBe(13);
		expect(cooldownFromRetryAfter(99_999)).toBe(3600);
	});
});

describe('счётчики', () => {
	it('attemptsLeft/sendsLeft не уходят в минус', () => {
		expect(attemptsLeft(0)).toBe(3);
		expect(attemptsLeft(5)).toBe(0);
		expect(sendsLeft(2)).toBe(3);
	});
	it('formatCountdown', () => {
		expect(formatCountdown(59)).toBe('0:59');
		expect(formatCountdown(125)).toBe('2:05');
		expect(formatCountdown(-3)).toBe('0:00');
	});
	it('secondsUntil', () => {
		expect(secondsUntil(10_000, 7_500)).toBe(3);
		expect(secondsUntil(1_000, 5_000)).toBe(0);
	});
	it('attemptsWord склоняет', () => {
		expect(attemptsWord(1)).toBe('попытка');
		expect(attemptsWord(2)).toBe('попытки');
		expect(attemptsWord(5)).toBe('попыток');
		expect(attemptsWord(11)).toBe('попыток');
		expect(attemptsWord(21)).toBe('попытка');
	});
});
