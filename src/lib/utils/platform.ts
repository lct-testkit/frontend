// Which modifier key this computer calls «the command key»: ⌘ on a Mac, Ctrl elsewhere. Keyboard handlers accept both (`ctrlKey || metaKey`);
// this is only for what the interface SHOWS.

export function isMac(): boolean {
	if (typeof navigator === 'undefined') return false;
	const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
	return /mac|iphone|ipad|ipod/i.test(data?.platform ?? navigator.platform ?? navigator.userAgent ?? '');
}

/** The modifier as text (a placeholder, a hint in a sentence): «⌘» or «Ctrl». */
export const modifierText = (): string => (isMac() ? '⌘' : 'Ctrl');
