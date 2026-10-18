export interface ShotEntry {
	name: string;
	file: string;
	sources?: string[];
}
export function needsRevBump(changedFiles: string[]): boolean;
export function revOf(source: string): string;
export function staleShots(manifest: ShotEntry[], commitTimes: Record<string, number>): ShotEntry[];
export function scriptsIn(markdown: string): string[];
export function envVarsIn(markdown: string): string[];
