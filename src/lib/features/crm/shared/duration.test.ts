import { describe, expect, it } from 'vitest';
import { MS_DAY, MS_HOUR, MS_MINUTE, formatDurationLong, formatDurationShort, parseIsoDuration, pluralRu } from './duration';

describe('parseIsoDuration', () => {
	it('разбирает формат pydantic (timedelta → ISO 8601)', () => {
		expect(parseIsoDuration('P1DT2H30M')).toBe(MS_DAY + 2 * MS_HOUR + 30 * MS_MINUTE);
		expect(parseIsoDuration('PT0S')).toBe(0);
		expect(parseIsoDuration('PT45.5S')).toBe(45_500);
		expect(parseIsoDuration('P2W')).toBe(14 * MS_DAY);
		expect(parseIsoDuration('-PT1H')).toBe(-MS_HOUR);
	});

	it('число — секунды; мусор и пустота — null', () => {
		expect(parseIsoDuration(3600)).toBe(MS_HOUR);
		expect(parseIsoDuration('вчера')).toBeNull();
		expect(parseIsoDuration(null)).toBeNull();
		expect(parseIsoDuration(undefined)).toBeNull();
	});
});

describe('pluralRu', () => {
	it('склоняет по правилам русского языка', () => {
		const forms: [string, string, string] = ['день', 'дня', 'дней'];
		expect(pluralRu(1, forms)).toBe('день');
		expect(pluralRu(2, forms)).toBe('дня');
		expect(pluralRu(5, forms)).toBe('дней');
		expect(pluralRu(11, forms)).toBe('дней');
		expect(pluralRu(21, forms)).toBe('день');
		expect(pluralRu(112, forms)).toBe('дней');
	});
});

describe('formatDuration*', () => {
	it('короткая форма — не больше двух единиц', () => {
		expect(formatDurationShort(2 * MS_DAY + 3 * MS_HOUR + 20 * MS_MINUTE)).toBe('2 д 3 ч');
		expect(formatDurationShort(3 * MS_HOUR)).toBe('3 ч');
		expect(formatDurationShort(45 * MS_MINUTE)).toBe('45 мин');
		expect(formatDurationShort(10_000)).toBe('меньше минуты');
		expect(formatDurationShort(null)).toBe('—');
	});

	it('длинная форма со склонениями', () => {
		expect(formatDurationLong(2 * MS_DAY + 3 * MS_HOUR)).toBe('2 дня 3 часа');
		expect(formatDurationLong(MS_HOUR)).toBe('1 час');
		expect(formatDurationLong(5 * MS_MINUTE)).toBe('5 минут');
		expect(formatDurationLong(MS_DAY)).toBe('1 день');
	});
});
