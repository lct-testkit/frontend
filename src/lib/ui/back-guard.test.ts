import { beforeEach, describe, expect, it, vi } from 'vitest';

// «Назад» браузера у диалога с несохранённым вводом спрашивает так же, как Esc и крестик (F-1): отмена навигации + «Закрыть без сохранения?».
let navigate: (nav: unknown) => void = () => {};
vi.mock('$app/navigation', () => ({ beforeNavigate: (cb: (nav: unknown) => void) => (navigate = cb), goto: vi.fn() }));
const confirmMock = vi.fn();
vi.mock('./confirm.svelte', () => ({ confirm: (...a: unknown[]) => confirmMock(...a), confirmState: { current: null } }));

import { useBackGuard } from './leave-guard.svelte';

const popstate = (over: Record<string, unknown> = {}) => ({ type: 'popstate', willUnload: false, delta: -1, to: { url: new URL('http://x/deals') }, cancel: vi.fn(), ...over });

beforeEach(() => {
	confirmMock.mockReset();
	vi.stubGlobal('history', { go: vi.fn() });
});

describe('useBackGuard', () => {
	it('диалог с вводом: «Назад» отменяется и спрашивает; «Продолжить» оставляет всё как есть', async () => {
		confirmMock.mockResolvedValue(false);
		useBackGuard(() => true);
		const nav = popstate();
		navigate(nav);
		expect(nav.cancel).toHaveBeenCalled();
		await vi.waitFor(() => expect(confirmMock).toHaveBeenCalled());
		expect(confirmMock.mock.calls[0][0]).toMatchObject({ title: 'Закрыть без сохранения?' });
		expect(history.go).not.toHaveBeenCalled();
	});

	it('«Закрыть» повторяет тот же шаг назад, и защита пропускает его', async () => {
		confirmMock.mockResolvedValue(true);
		useBackGuard(() => true);
		navigate(popstate({ delta: -2 }));
		await vi.waitFor(() => expect(history.go).toHaveBeenCalledWith(-2));
		const again = popstate();
		navigate(again);
		expect(again.cancel).not.toHaveBeenCalled();
	});

	it('без ввода, не «назад» и закрытие вкладки — не вмешивается', () => {
		useBackGuard(() => false);
		const clean = popstate();
		navigate(clean);
		expect(clean.cancel).not.toHaveBeenCalled();

		useBackGuard(() => true);
		for (const extra of [{ type: 'link' }, { type: 'goto' }, { willUnload: true }]) {
			const nav = popstate(extra);
			navigate(nav);
			expect(nav.cancel).not.toHaveBeenCalled();
		}
	});
});
