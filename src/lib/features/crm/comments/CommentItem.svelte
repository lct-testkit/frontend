<script lang="ts">
	// Один комментарий: автор, время, «изменён», внутренний — жёлтая пилюля, системная запись — серой строкой. Текст — безопасный Markdown.
	import { Pencil, Reply, Trash } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Avatar, Btn, DateText, IconBtn, StatusChip, confirm, toast } from '$lib/ui';
	import { renderMarkdown } from '$lib/utils/markdown';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import type { Comment } from '../types';

	interface Props {
		comment: Comment;
		canWrite: boolean;
		onReply?: (comment: Comment) => void;
		onChanged: (comment: Comment) => void;
		onRemoved: (id: string) => void;
	}

	let { comment, canWrite, onReply, onChanged, onRemoved }: Props = $props();

	const mine = $derived(!!comment.author_id && comment.author_id === session.me?.id);
	const canEdit = $derived(canWrite && !comment.is_system && (mine || session.isRole('ADMIN')));
	const canDelete = $derived(canWrite && !comment.is_system && (mine || session.isRole('HEAD', 'ADMIN')));

	let editing = $state(false);
	let draft = $state('');
	let busy = $state(false);

	function startEdit() {
		draft = comment.body;
		editing = true;
	}

	async function save() {
		const body = draft.trim();
		if (!body || busy) return;
		busy = true;
		try {
			onChanged(await unwrap(api.PATCH('/api/comments/{comment_id}', { params: { path: { comment_id: comment.id } }, body: { body } })));
			editing = false;
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!(await confirm({ title: 'Удалить комментарий?', confirmLabel: 'Удалить', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/comments/{comment_id}', { params: { path: { comment_id: comment.id } }, body: {} }));
			onRemoved(comment.id);
		} catch (e) {
			toast.error(e);
		}
	}
</script>

{#if comment.is_system}
	<p class="t-desc-l m-0 flex flex-wrap items-baseline gap-x-2 py-1 text-muted">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown of a comment: rendered through DOMPurify (renderMarkdown) -->
		<span class="[&_p]:m-0 [&_p]:inline">{@html renderMarkdown(comment.body)}</span>
		<span class="text-soft"><DateText value={comment.created_at} time /></span>
	</p>
{:else}
	<article class={['group flex min-w-0 gap-3 rounded-md p-2', comment.is_internal && 'bg-warning-soft']} data-comment={comment.id}>
		<Avatar name={people.name(comment.author_id)} size={32} />
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<header class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span class="t-body-m-strong">{people.name(comment.author_id)}</span>
				<span class="t-desc-l text-muted"><DateText value={comment.created_at} time /></span>
				{#if comment.edited_at}<span class="t-desc-l text-soft" title={new Date(comment.edited_at).toLocaleString('ru-RU')}>изменён</span>{/if}
				{#if comment.is_internal}<StatusChip label="Внутренний" tone="warning" />{/if}
				<span class="ml-auto flex items-center max-md:opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100 md:group-focus-within:opacity-100">
					{#if canWrite && onReply}<IconBtn icon={Reply} label="Ответить" size="s" onclick={() => onReply(comment)} />{/if}
					{#if canEdit && !editing}<IconBtn icon={Pencil} label="Редактировать" size="s" onclick={startEdit} />{/if}
					{#if canDelete}<IconBtn icon={Trash} label="Удалить" size="s" danger onclick={remove} />{/if}
				</span>
			</header>
			{#if editing}
				<AreaField value={draft} rows={2} onInput={(v) => (draft = v)} onSubmit={save} autofocus />
				<div class="flex gap-2">
					<Btn label="Сохранить" size="s" loading={busy} onclick={save} />
					<Btn label="Отмена" size="s" variant="ghost" colorScheme="neutral" onclick={() => (editing = false)} />
				</div>
			{:else}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- markdown of a comment: rendered through DOMPurify (renderMarkdown) -->
				<div class="md [&>:first-child]:mt-0 [&>:last-child]:mb-0">{@html renderMarkdown(comment.body)}</div>
			{/if}
		</div>
	</article>
{/if}
