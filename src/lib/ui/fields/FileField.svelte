<script lang="ts">
	// The file zone of a form — the DS FileUpload for ONE file. It sends nothing anywhere: it hands the chosen file to `onPick` (and calls `onClear` when the file is taken
	// off the list). `label` is the text in the zone, `hint` the line under it (what the file may be), `error` a mark on the file's row, `loading` a spinner on it while the
	// file is being sent. `fileName` is a file chosen earlier (a wizard step opened again) until another one is chosen.
	import { FileUpload } from '@lct-testkit/rt-ui';

	/** MIME type → extensions, the `accept` of the DS FileUpload */
	export type FileAccept = Record<string, string[]>;

	interface Props {
		onPick: (file: File) => void;
		onClear?: () => void;
		accept?: FileAccept;
		label?: string;
		hint?: string;
		fileName?: string | null;
		disabled?: boolean;
		loading?: boolean;
		error?: string;
	}

	let { onPick, onClear, accept = { 'application/pdf': ['.pdf'] }, label = 'Выберите файл или перетащите его сюда', hint, fileName = null, disabled = false, loading = false, error }: Props = $props();

	let picked = $state<string | null>(null);
</script>

<FileUpload
	{accept}
	subtitle={label}
	hint={fileName && !picked ? `Выбран файл: ${fileName}` : hint}
	{disabled}
	statuses={picked && (loading || error) ? { [picked]: { loading, error } } : {}}
	onChange={(files) => {
		const file = files[0];
		picked = file?.name ?? null;
		if (file) onPick(file);
		else onClear?.();
	}}
/>
