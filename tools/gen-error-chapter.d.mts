export interface ErrorCatalog {
	areas: { key: string; title: string; prefix: string }[];
	codes: { code: string; status: number; title: string; area: string; who: string; meaning: string; action: string; reserved?: boolean }[];
}
export function buildChapter(catalog: ErrorCatalog): string;
