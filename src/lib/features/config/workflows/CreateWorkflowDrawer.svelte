<script lang="ts">
	// Создание воронки: название, код (по названию), тип сделки, «по умолчанию». Остальное — в редакторе.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, unwrap, idem } from '$lib/api';
	import { toast } from '$lib/ui';
	import { DEAL_TYPES, DEAL_TYPE_LABELS, makeCode } from './graph';
	import { FormDrawer } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	interface Props {
		open: boolean;
		takenCodes: readonly string[];
		onClose: () => void;
	}

	let { open, takenCodes, onClose }: Props = $props();

	let name = $state('');
	let code = $state('');
	let codeTouched = $state(false);
	let dealType = $state<string | null>('b2b');
	let isDefault = $state(false);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = '';
			code = '';
			codeTouched = false;
			dealType = 'b2b';
			isDefault = false;
			errors = {};
			formError = null;
			idemKey = crypto.randomUUID();
		});
	});

	function rename(v: string) {
		name = v;
		if (!codeTouched) code = v.trim() ? makeCode(v, takenCodes, 'workflow') : '';
	}

	async function save() {
		const next: Record<string, string> = {};
		if (!name.trim()) next.name = 'Укажите название';
		if (!/^[a-z][a-z0-9_]{1,63}$/.test(code)) next.code = 'Латиница, цифры и «_», начинается с буквы';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const created = await unwrap(api.POST('/api/workflows', { body: { code, name: name.trim(), deal_type: dealType as 'b2b' | 'b2c', is_default: isDefault }, headers: idem(idemKey) }));
			toast.success('Воронка создана');
			onClose();
			void goto(`/workflows/${created.id}`);
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'name', 'deal_type']);
			errors = failure.fields;
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title="Новая воронка" width={440} {saving} {formError} saveLabel="Создать" onSave={save} {onClose}>
	<TextField label="Название" required value={name} error={errors.name} maxlength={255} autofocus onInput={rename} />
	<TextField
		label="Код"
		required
		bind:value={code}
		error={errors.code}
		maxlength={64}
		hint="Латиница, цифры и «_»; после создания не меняется"
		onInput={() => (codeTouched = true)}
	/>
	<Pick label="Тип сделки" bind:value={dealType} items={DEAL_TYPES.map((t) => ({ key: t, value: DEAL_TYPE_LABELS[t] }))} />
	<Toggle label="По умолчанию для этого типа" bind:checked={isDefault} hint="Новые сделки создаются в воронке по умолчанию" />
</FormDrawer>
