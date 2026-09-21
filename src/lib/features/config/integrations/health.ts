// Состояние системы: `/health/ready` при падении критичной зависимости отвечает 503 с тем же JSON (backend-issues #25),
// поэтому читаем обычным fetch, а не через `unwrap`.
import type { HealthReport } from '../types';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
	let res: Response;
	try {
		res = await fetch('/health/ready', { signal, cache: 'no-store' });
	} catch (e) {
		if (signal?.aborted) throw e;
		return { status: 'unavailable', dependencies: [] };
	}
	try {
		const body = (await res.json()) as Partial<HealthReport>;
		return { status: body.status ?? (res.ok ? 'ok' : 'unavailable'), dependencies: Array.isArray(body.dependencies) ? body.dependencies : [] };
	} catch {
		return { status: res.ok ? 'ok' : 'unavailable', dependencies: [] };
	}
}

export const healthTone = (status: string): 'success' | 'warning' | 'error' => (status === 'ok' ? 'success' : status === 'degraded' ? 'warning' : 'error');
