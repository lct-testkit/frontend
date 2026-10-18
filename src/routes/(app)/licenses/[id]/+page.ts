import { redirect } from '@sveltejs/kit';

// Ссылка «поделиться» на лицензию: открывает список с панелью этой лицензии (`/licenses?edit=<id>`).
export function load({ params }: { params: { id: string } }) {
	redirect(307, `/licenses?edit=${encodeURIComponent(params.id)}`);
}
