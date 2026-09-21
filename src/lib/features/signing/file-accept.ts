// Допустимые типы файлов для зоны выбора: формат `accept` у FileUpload дизайн-системы (MIME → расширения).
export type AcceptProp = Record<string, string[]>;

// скан соглашения об ЭДО
export const SCAN_ACCEPT: AcceptProp = {
	'application/pdf': ['.pdf'],
	'image/png': ['.png'],
	'image/jpeg': ['.jpg', '.jpeg'],
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};
