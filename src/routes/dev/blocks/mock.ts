// Мок-данные каталога блоков: правдоподобные, чтобы видеть реальные длины строк.
export interface MockContact {
	id: string;
	name: string;
	position: string;
	org: string;
	email: string;
	phone: string;
	decisionMaker: boolean;
}

export const CONTACTS: MockContact[] = [
	{ id: '1', name: 'Фомин Артём Юрьевич', position: 'Генеральный директор', org: 'Цифровые кадры', email: 'a***@cifrovyekadry.example.ru', phone: '+7 (9**) ***-**-32', decisionMaker: true },
	{ id: '2', name: 'Зайцева Дарья Максимовна', position: 'Начальник отдела партнёрств', org: 'КСУТ', email: 'd***@ksut.example.ru', phone: '+7 (9**) ***-**-50', decisionMaker: false },
	{ id: '3', name: 'Титов Николай Андреевич', position: 'Руководитель центра компетенций', org: 'МОУПН', email: 'n***@moupn.example.ru', phone: '+7 (9**) ***-**-85', decisionMaker: true },
	{ id: '4', name: 'Белова Ирина Олеговна', position: 'Проректор по развитию', org: 'СПбИЦЭ', email: 'i***@spbice.example.ru', phone: '+7 (9**) ***-**-24', decisionMaker: true },
	{ id: '5', name: 'Панин Виктор Степанович', position: 'Директор', org: 'ВГКИТ', email: 'v***@vgkit.example.ru', phone: '+7 (9**) ***-**-14', decisionMaker: true },
	{ id: '6', name: 'Орлова Марина Игоревна', position: 'Заведующая кафедрой', org: 'ЧИПМ', email: 'm***@chipm.example.ru', phone: '+7 (9**) ***-**-30', decisionMaker: false },
	{ id: '7', name: 'Хабибуллин Айрат Маратович', position: 'Начальник управления ДПО', org: 'УАТУ', email: 'a***@uatu.example.ru', phone: '+7 (9**) ***-**-48', decisionMaker: true },
	{ id: '8', name: 'Литвинова Елена Николаевна', position: 'Директор', org: 'РКСИ', email: 'e***@rksi.example.ru', phone: '+7 (9**) ***-**-55', decisionMaker: true },
	{ id: '9', name: 'Мироненко Сергей Владимирович', position: 'Проректор', org: 'КубГАТУ', email: 's***@kubgatu.example.ru', phone: '+7 (9**) ***-**-80', decisionMaker: false },
	{ id: '10', name: 'Соколов Игорь Анатольевич', position: 'Декан факультета информатики', org: 'УФИ', email: 'i***@ufii.example.ru', phone: '+7 (9**) ***-**-85', decisionMaker: false },
	{ id: '11', name: 'Громова Анна Петровна', position: 'Проректор по учебной работе', org: 'НИЦТ', email: 'a***@nict.example.ru', phone: '+7 (9**) ***-**-18', decisionMaker: true },
	{ id: '12', name: 'Малышев Дмитрий Сергеевич', position: 'Директор ИТ-института', org: 'ППУ', email: 'd***@ppu.example.ru', phone: '+7 (9**) ***-**-90', decisionMaker: false }
];

export const LONG_NAME_CONTACT: MockContact = {
	id: '99',
	name: 'Константинопольская-Ивановская Александра-Мария Владиславовна',
	position: 'Заместитель проректора по научно-образовательной и международной деятельности',
	org: 'Федеральное государственное автономное образовательное учреждение высшего образования «Национальный исследовательский университет»',
	email: 'a***@very-long-university-domain-name.example.ru',
	phone: '+7 (9**) ***-**-01',
	decisionMaker: true
};

export const STATUS_ITEMS = [
	{ key: 'new', value: 'Новый' },
	{ key: 'talks', value: 'Переговоры' },
	{ key: 'contract', value: 'Договор' },
	{ key: 'pause', value: 'Пауза' }
];

export const CITY_ITEMS = ['Казань', 'Самара', 'Екатеринбург', 'Новосибирск', 'Пермь', 'Уфа', 'Красноярск', 'Воронеж'].map((c) => ({ key: c, value: c }));
