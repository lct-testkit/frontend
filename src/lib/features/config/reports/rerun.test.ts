import { describe, expect, it } from 'vitest';
import { knownParams, setRerun, takeRerun } from './rerun';

describe('повторный запуск отчёта', () => {
	it('запрос забирается один раз и только для своего шаблона', () => {
		setRerun({ code: 'deal_register', params: { limit: 5 }, format: 'xls' });
		expect(takeRerun('kam_summary')).toBeNull();
		setRerun({ code: 'deal_register', params: { limit: 5 }, format: 'xls' });
		expect(takeRerun('deal_register')).toEqual({ code: 'deal_register', params: { limit: 5 }, format: 'xls' });
		expect(takeRerun('deal_register')).toBeNull();
	});

	it('служебные, устаревшие и пустые ключи отбрасываются', () => {
		expect(knownParams({ limit: 5, _seed: 'demo', удалён: 1, date_from: null, columns: ['a'] }, ['limit', 'date_from', 'columns'])).toEqual({ limit: 5, columns: ['a'] });
	});
});
