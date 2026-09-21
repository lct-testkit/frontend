<script lang="ts">
	import { modifierText } from '$lib/utils/platform';
	// Вкладка «Обсуждение»: комментарии деревом (ответы под родителем), системные записи серым, форма внизу.
	// Ctrl/⌘+Enter отправляет; «@» вставляет упоминание; «внутренний» скрыт от внешних ролей (замок).
	import { untrack } from 'svelte';
	import { CloseSmall, Send } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { Btn, EmptyState, ErrorState, IconBtn, Skeleton, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import type { Comment } from '../types';
	import CommentItem from './CommentItem.svelte';

	interface Props {
		dealId: string;
		canWrite: boolean;
		/** меняется после переходов и переназначений: там появляются системные записи */
		refreshKey?: number;
		onCount?: (count: number) => void;
	}

	let { dealId, canWrite, refreshKey = 0, onCount }: Props = $props();

	let items = $state<Comment[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	let text = $state('');
	let internal = $state(false);
	let replyTo = $state<Comment | null>(null);
	let mentions = $state<string[]>([]);
	let picking = $state(false);
	let busy = $state(false);

	async function load() {
		error = null;
		try {
			items = (await unwrap(api.GET('/api/deals/{deal_id}/comments', { params: { path: { deal_id: dealId } } }))).items;
			people.ensure(items.map((c) => c.author_id));
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void refreshKey;
		untrack(() => void load());
	});
	$effect(() => onCount?.(items.filter((c) => !c.is_system).length));

	/** корневые комментарии по времени; ответы любой глубины лежат под корнем */
	const threads = $derived.by(() => {
		const byId = new Map(items.map((c) => [c.id, c]));
		const rootOf = (c: Comment): string => {
			let cur = c;
			for (let i = 0; i < 20 && cur.parent_id && byId.has(cur.parent_id); i += 1) cur = byId.get(cur.parent_id)!;
			return cur.id;
		};
		const roots = items.filter((c) => !c.parent_id || !byId.has(c.parent_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
		return roots.map((root) => ({
			root,
			replies: items.filter((c) => c.id !== root.id && rootOf(c) === root.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
		}));
	});

	async function send() {
		const body = text.trim();
		if (!body || busy) return;
		busy = true;
		try {
			const created = await unwrap(
				api.POST('/api/deals/{deal_id}/comments', {
					params: { path: { deal_id: dealId } },
					body: { body, parent_id: replyTo?.id ?? null, is_internal: internal, mentions: [...new Set(mentions)] }
				})
			);
			items = [...items, created];
			text = '';
			replyTo = null;
			mentions = [];
			picking = false;
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	function mention(id: string | null) {
		if (!id) return;
		mentions = [...mentions, id];
		text = `${text}${text && !text.endsWith(' ') ? ' ' : ''}@${people.name(id)} `;
		picking = false;
	}

	const changed = (c: Comment) => (items = items.map((x) => (x.id === c.id ? c : x)));
	const removed = (id: string) => (items = items.filter((x) => x.id !== id && x.parent_id !== id));
</script>

<div class="flex min-w-0 flex-col gap-3">
	{#if loading}
		<Skeleton kind="list" rows={4} />
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if threads.length === 0}
		<EmptyState title="Комментариев пока нет" compact />
	{:else}
		<div class="flex flex-col gap-2">
			{#each threads as thread (thread.root.id)}
				<div class="flex flex-col gap-1">
					<CommentItem comment={thread.root} {canWrite} onReply={(c) => ((replyTo = c), (picking = false))} onChanged={changed} onRemoved={removed} />
					{#if thread.replies.length}
						<div class="ml-4 flex flex-col gap-1 border-l-2 border-line pl-3 max-md:ml-2 max-md:pl-2">
							{#each thread.replies as reply (reply.id)}
								<CommentItem comment={reply} {canWrite} onReply={(c) => ((replyTo = c), (picking = false))} onChanged={changed} onRemoved={removed} />
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if canWrite}
		<form
			class="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-m max-md:-mx-2"
			onsubmit={(e) => {
				e.preventDefault();
				void send();
			}}
		>
			<!-- цитата комментария, на который отвечаем: укороченный текст с крестиком, у rt-ui для этого нет компонента -->
			{#if replyTo}
				<div class="t-desc-l flex items-center gap-2 rounded-sm bg-surface-3 px-2 py-1 text-muted">
					<span class="min-w-0 flex-1 truncate">Ответ для {people.name(replyTo.author_id)}: {replyTo.body}</span>
					<IconBtn icon={CloseSmall} label="Отменить ответ" size="s" onclick={() => (replyTo = null)} />
				</div>
			{/if}
			{#if picking}<UserPicker label="Кого упомянуть" value={null} clearable={false} onChange={(id) => mention(id)} />{/if}
			<AreaField placeholder="Комментарий (Markdown, {modifierText()}+Enter — отправить)" value={text} rows={2} maxRows={6} onInput={(v) => (text = v)} onSubmit={send} />
			<div class="flex flex-wrap items-center gap-3">
				<CheckField label="Внутренний" checked={internal} onChange={(v) => (internal = v)} />
				<Btn label="@" variant="ghost" colorScheme="neutral" size="s" aria-label="Упомянуть коллегу" onclick={() => (picking = !picking)} />
				<Btn class="ml-auto" label="Отправить" icon={Send} type="submit" loading={busy} disabled={!text.trim()} data-testid="comment-send" />
			</div>
		</form>
	{/if}
</div>
