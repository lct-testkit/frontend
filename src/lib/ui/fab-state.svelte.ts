// Is the floating create-button on screen? The shell leaves room under the content for it, so the last row of a list is not covered at the end of the scroll.
/** `hidden` > 0: something that fills the bottom of the screen is open (the filter panel of a phone) — the button steps aside, it must not cover its «Готово» */
export const fabState = $state({ visible: 0, hidden: 0 });
