<script lang="ts">
	// Фильтры списка пользователей. Значения живут в адресной строке (родитель), тут только ввод.
	// Кнопка «Создать» (`primary`) стоит в конце этой же строки, а не отдельной строкой над ней.
	import { onMount } from 'svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import type { Primary } from '$lib/ui/PrimaryAction.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { ASSIGNABLE_ROLES, ROLE_LABEL, userStatusMeta } from '../labels';
	import { teams } from '../teams.svelte';

	interface Values {
		q: string;
		role: string;
		status: string;
		team_id: string;
	}

	let { values, onChange, primary }: { values: Values; onChange: (patch: Partial<Values>) => void; primary?: Primary } = $props();

	onMount(() => void teams.load());

	const roles = ASSIGNABLE_ROLES.map((r) => ({ key: r, value: ROLE_LABEL[r] }));
	const statuses = ['invited', 'active', 'blocked', 'terminated', 'anonymized'].map((s) => ({ key: s, value: userStatusMeta(s).label }));
	const active = $derived([values.role, values.status, values.team_id].filter(Boolean).length);
</script>

{#snippet filters()}
	<Pick label="Роль" items={roles} value={values.role || null} clearable placeholder="Любая" onChange={(v) => onChange({ role: v ?? '' })} />
	<Pick label="Статус" items={statuses} value={values.status || null} clearable placeholder="Любой" onChange={(v) => onChange({ status: v ?? '' })} />
	<Pick label="Команда" items={teams.options} value={values.team_id || null} clearable search placeholder="Любая" onChange={(v) => onChange({ team_id: v ?? '' })} />
{/snippet}

<FilterBar search={values.q} placeholder="Имя или email" onSearch={(q) => onChange({ q })} {active} onReset={() => onChange({ role: '', status: '', team_id: '' })} {filters} {primary} />
