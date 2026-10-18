import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scan } from './screen-states.mjs';

// маршрут -> состояние -> причина, по которой состояние к экрану не относится
const allow = JSON.parse(readFileSync(new URL('./screen-states.allow.json', import.meta.url), 'utf8'));
const rows = scan();
const STATES = ['loading', 'empty', 'error'];

describe('три состояния экрана', () => {
	it('найдены все экраны', () => expect(rows.length).toBeGreaterThanOrEqual(47));
	for (const row of rows) {
		it(row.route, () => {
			for (const state of STATES) {
				if (!row[state]) expect(allow[row.route]?.[state], `${row.route}: нет признака «${state}» и нет причины в screen-states.allow.json`).toBeTruthy();
				else expect(allow[row.route]?.[state], `${row.route}: «${state}» уже есть, уберите запись из allow-list`).toBeUndefined();
			}
		});
	}
});
