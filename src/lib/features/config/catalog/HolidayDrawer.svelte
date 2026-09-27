<script lang="ts">
	// Дата производственного календаря: праздник (нерабочий день) или перенос (рабочий день на выходной).
	import { untrack } from 'svelte';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import type { Holiday } from '../types';
	import { FormDrawer } from '$lib/ui';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	interface Props {
		open: boolean;
		item: Holiday | null;
		/** дата по умолчанию для новой записи (ГГГГ-ММ-ДД) */
		presetDate?: string | null;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open, item, presetDate = null, onClose, onSaved }: Props = $props();

	let date = $state<string | null>(null);
	let name = $state('');
	let working = $state(false);
	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			date = item?.date ?? presetDate;
			name = item?.name ?? '';
			working = item?.is_working_day ?? false;
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	async function save() {
		const next: Record<string, string> = {};
		if (!date) next.date = 'Выберите дату';
		if (!name.trim()) next.name = 'Укажите название';
		errors = next;
		if (Object.keys(next).length || !date) return;
		saving = true;
		formError = null;
		try {
			const body = { date, name: name.trim(), is_working_day: working };
			if (item) await unwrap(api.PATCH('/api/holidays/{holiday_id}', { params: { path: { holiday_id: item.id } }, body, headers: ifMatch(version) }));
			else await unwrap(api.POST('/api/holidays', { body, headers: idem(idemKey) }));
			toast.success(item ? 'Дата сохранена' : 'Дата добавлена');
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['date', 'name']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий: берём актуальную версию записи (без фильтра по году — дату конфликтующей записи мы не знаем заранее), введённое остаётся в форме. */
	async function reload() {
		if (!item) return;
		try {
			const res = await unwrap(api.GET('/api/holidays', {}));
			const fresh = res.items.find((h) => h.id === item.id);
			if (fresh) {
				version = fresh.version;
				conflict = false;
				toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
			}
		} catch (e) {
			toast.error(e);
		} finally {
			onSaved();
		}
	}
</script>

<FormDrawer {open} title={isNew ? 'Новая дата' : name || 'Дата календаря'} width={420} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reload}>
	<DateField label="Дата" required bind:value={date} error={errors.date} />
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} placeholder="Например, День народного единства" autofocus />
	<Toggle label="Рабочий день" bind:checked={working} hint="Перенос: выходной становится рабочим днём" />
</FormDrawer>
