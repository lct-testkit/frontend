<script lang="ts">
	// Поля контакта. При правке e-mail и телефон приходят маскированными: поле только для чтения, пока не нажали «Показать» (запись в журнал).
	// Каналы связи (Telegram и др.) задаются только при создании — так устроен бэкенд (backend-issues A-20).
	import { AddLarge, CloseSmall, PasswordShow } from '@lct-testkit/rt-ui/icons';
	import { Btn, CheckField, FormRow, IconBtn } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import OrgPicker from '../shared/pickers/OrgPicker.svelte';
	import { CONTACT_CHANNEL_LABELS } from '../shared/labels';
	import { isMasked, type ContactFormValues } from './contactUtils';

	interface Props {
		values: ContactFormValues;
		errors?: Record<string, string>;
		/** правка: каналы не редактируются, маски требуют «Показать» */
		editing?: boolean;
		organizationLocked?: boolean;
		disabled?: boolean;
		onReveal?: () => void;
	}

	let { values = $bindable(), errors = {}, editing = false, organizationLocked = false, disabled = false, onReveal }: Props = $props();

	const channelItems = Object.entries(CONTACT_CHANNEL_LABELS).map(([key, value]) => ({ key, value }));
	const masked = $derived(isMasked(values.email) || isMasked(values.phone));

	function addChannel() {
		values.channels = [...values.channels, { type: 'telegram', value: '', is_primary: values.channels.length === 0 }];
	}
</script>

<FormRow>
	<TextField label="Фамилия" autofocus={!editing} value={values.last_name} error={errors.last_name} {disabled} onInput={(v) => (values.last_name = v)} />
	<TextField label="Имя" value={values.first_name} error={errors.first_name} {disabled} onInput={(v) => (values.first_name = v)} />
	<TextField label="Отчество" value={values.middle_name} {disabled} onInput={(v) => (values.middle_name = v)} />
	<TextField label="Должность" value={values.position} {disabled} onInput={(v) => (values.position = v)} />
	{#if !organizationLocked}
		<div class="col-span-2 max-md:col-span-1">
			<OrgPicker label="Организация" value={values.organization_id} {disabled} onChange={(id) => (values.organization_id = id)} />
		</div>
	{/if}
	<div class="flex items-start gap-1">
		<TextField class="min-w-0 flex-1" label="Телефон" value={values.phone} error={errors.phone} readonly={isMasked(values.phone)} inputmode="tel" {disabled} onInput={(v) => (values.phone = v)} />
	</div>
	<div class="flex items-start gap-1">
		<TextField class="min-w-0 flex-1" label="E-mail" value={values.email} error={errors.email} readonly={isMasked(values.email)} inputmode="email" {disabled} onInput={(v) => (values.email = v)} />
		{#if editing && masked && onReveal}<IconBtn icon={PasswordShow} label="Показать контакты" class="mt-1" onclick={onReveal} />{/if}
	</div>
</FormRow>

<CheckField label="Лицо, принимающее решения" checked={values.is_decision_maker} {disabled} onChange={(v) => (values.is_decision_maker = v)} />

{#if !editing}
	<div class="flex flex-col gap-2">
		{#each values.channels as channel, i (i)}
			<div class="flex items-start gap-2">
				<Pick class="w-40 flex-none max-md:w-32" items={channelItems} value={channel.type} {disabled} onChange={(v) => v && (channel.type = v)} />
				<TextField class="min-w-0 flex-1" placeholder={channel.type === 'telegram' ? '@username' : 'Значение'} value={channel.value} {disabled} onInput={(v) => (channel.value = v)} />
				<IconBtn icon={CloseSmall} label="Убрать канал" class="mt-1" onclick={() => (values.channels = values.channels.filter((_, j) => j !== i))} />
			</div>
		{/each}
		<div><Btn label="Канал связи" icon={AddLarge} size="s" variant="ghost" onclick={addChannel} /></div>
	</div>
{/if}
