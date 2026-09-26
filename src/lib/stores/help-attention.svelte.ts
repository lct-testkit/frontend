// «Справка» просит внимания (точка у иконки, волна под названием в меню), пока человек не открыл её после последнего обновления глав.
// Запоминаем ревизию, которую он видел, а не просто «был»: добавили главы — поменяли `HELP_REV` — метка загорается снова у тех, кто читал старую справку.
export const HELP_REV = '2026-09-25';

const KEY = 'rtk.help.seen';

class HelpAttention {
	// до чтения хранилища метку не показываем: иначе она мигнёт на первой отрисовке у тех, кто справку уже видел
	seen = $state(true);

	init() {
		try {
			this.seen = localStorage.getItem(KEY) === HELP_REV;
		} catch {
			this.seen = false; // хранилище закрыто — показываем; после открытия справки метка погаснет до перезагрузки
		}
	}

	markSeen() {
		this.seen = true;
		try {
			localStorage.setItem(KEY, HELP_REV);
		} catch {
			// ignore
		}
	}

	get show() {
		return !this.seen;
	}
}

export const helpAttention = new HelpAttention();
