// Стиль-гейт дизайн-системы (спека §12.6): цвета берутся ТОЛЬКО из токенов темы (`var(--atmr-…)` и классов
// Tailwind, отображённых в @theme в src/app.css). «Сырой» hex/rgb() в стилях ломает переключение тем
// (светлая/тёмная) и расползается через несколько недель работы.
//
// Проверяются *.css и <style>-блоки *.svelte. Определения самих токенов живут в src/app.css (там же
// осознанное исключение для цвета до применения темы JS — помечено stylelint-disable с причиной).
/** @type {import('stylelint').Config} */
export default {
	overrides: [
		{ files: ['**/*.svelte'], customSyntax: 'postcss-html' }
	],
	ignoreFiles: ['build/**', '.svelte-kit/**', 'node_modules/**', 'static/**', 'docs/**', 'tools/**'],
	rules: {
		'color-no-hex': [true, { message: 'Цвет — только из токенов темы: var(--atmr-…) или класс Tailwind из @theme (src/app.css)' }],
		'function-disallowed-list': [
			['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch'],
			{ message: 'Цвет — только из токенов темы: var(--atmr-…) или класс Tailwind из @theme (src/app.css)' }
		],
		'color-named': ['never', { message: 'Именованные цвета (red, blue…) запрещены — используйте токены темы' }]
	}
};
