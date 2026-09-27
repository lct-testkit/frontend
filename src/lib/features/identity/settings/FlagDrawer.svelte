<script lang="ts">
	// Новый флаг функциональности: код (латиница, snake_case), описание, включён ли сразу. Код после создания не меняется.
	import { untrack } from 'svelte';
	import { api, unwrap, idem, type components } from '$lib/api';
	import { FormDrawer, toast } from '$lib/ui';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '$lib/features/config/shared/form-errors';

	type Flag = components['schemas']['FeatureFlagOut'];

	interface Props {
		open: boolean;
		onClose: () => void;
		onCreated: (flag: Flag) => void;
	}

	let { open, onClose, onCreated }: Props = $props();

	let code = $state('');
	let description = $state('');
	let enabled = $state(false);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			code = '';
			description = '';
			enabled = false;
			errors = {};
			formError = null;
			idemKey = crypto.randomUUID();
		});
	});

	const CODE_RE = /^[a-z][a-z0-9_]{1,62}$/;

	async function save() {
		formError = null;
		const next: Record<string, string> = {};
		if (!CODE_RE.test(code.trim())) next.code = 'Латиница, цифры и «_», с буквы, от 2 до 63 знаков';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		try {
			const flag = await unwrap(api.POST('/api/admin/feature-flags', { body: { code: code.trim(), description: description.trim() || null, is_enabled: enabled, rollout: 100 }, headers: idem(idemKey) }));
			toast.success('Флаг создан');
			onCreated(flag);
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'description', 'is_enabled', 'rollout']);
			errors = { ...failure.fields };
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title="Новый флаг" saveLabel="Создать" {saving} {formError} onSave={save} {onClose}>
	<TextField label="Код" required bind:value={code} error={errors.code} maxlength={63} autofocus hint="Например, new_deal_card" />
	<TextField label="Описание" bind:value={description} error={errors.description} maxlength={1000} />
	<Toggle label="Включить сразу" bind:checked={enabled} hint="Иначе флаг создаётся выключенным" />
</FormDrawer>
