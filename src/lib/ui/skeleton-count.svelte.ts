// «Загрузка» / «Готово» для экранного читателя: считает смонтированные скелетоны. Объявляет после 400 мс непрерывной загрузки (быстрые ответы молчат)
// и один раз «Готово», когда счётчик вернулся к нулю.
export const loadingAnnouncement = $state({ text: '' });

let count = 0;
let announced = false;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let doneTimer: ReturnType<typeof setTimeout> | undefined;

export function skeletonMounted(): () => void {
	count++;
	clearTimeout(doneTimer);
	if (count === 1 && !announced) {
		clearTimeout(showTimer);
		showTimer = setTimeout(() => {
			if (count > 0) {
				announced = true;
				loadingAnnouncement.text = 'Загрузка';
			}
		}, 400);
	}
	return () => {
		count = Math.max(0, count - 1);
		if (count > 0) return;
		clearTimeout(showTimer);
		if (!announced) return;
		doneTimer = setTimeout(() => {
			if (count === 0) {
				announced = false;
				loadingAnnouncement.text = 'Готово';
				setTimeout(() => {
					if (loadingAnnouncement.text === 'Готово') loadingAnnouncement.text = '';
				}, 3000);
			}
		}, 300);
	};
}
