import { describe, expect, it } from 'vitest';
import { describeUserAgent, sortSessions } from './sessions';

describe('describeUserAgent', () => {
	it('браузер и ОС', () => {
		expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36')).toBe('Chrome · Windows');
		expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
		expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0')).toBe('Edge · Windows');
	});
	it('API-клиент и пусто', () => {
		expect(describeUserAgent('python-httpx/0.27')).toBe('python-httpx/0.27');
		expect(describeUserAgent(null, 'Android')).toBe('Android');
		expect(describeUserAgent(null)).toBe('Неизвестное устройство');
	});
});

describe('sortSessions', () => {
	it('текущая первой, затем по активности', () => {
		const sorted = sortSessions([
			{ sid: 'a', created_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-09-02T00:00:00Z' },
			{ sid: 'b', created_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-09-03T00:00:00Z' },
			{ sid: 'c', created_at: '2026-09-01T00:00:00Z', last_seen_at: '2026-08-01T00:00:00Z', is_current: true }
		]);
		expect(sorted.map((s) => s.sid)).toEqual(['c', 'b', 'a']);
	});
});
