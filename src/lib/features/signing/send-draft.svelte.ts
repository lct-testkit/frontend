// Черновик мастера «Отправить на подпись» по сделке: источник документа, подписанты, порядок, срок → создание + отправка.
import { ApiError, api, unwrap } from '$lib/api';
import { uploadFile } from '$lib/api/upload';
import { createDocument, listTemplates, sendDocument } from './api';
import { rememberDocument } from './known';
import { externalNotFirstWarning } from './status';
import type { SignatureDocument, SignatureTemplate, SignerSpec } from './types';

export interface DealContext {
	number: string;
	contactId: string | null;
	contactName: string | null;
	organizationId: string | null;
}

export type SignerKey = 'head' | 'contact' | 'lpr' | 'user';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class SendDraft {
	step = $state(0);
	loading = $state(true);
	loadError = $state<unknown>(null);
	busy = $state(false);
	error = $state<string | null>(null);
	/** ошибка у поля подписантов (сервер не смог определить подписанта) */
	signersError = $state<string | null>(null);

	deal = $state<DealContext | null>(null);
	templates = $state<SignatureTemplate[]>([]);

	source = $state<'template' | 'file'>('template');
	templateCode = $state<string | null>(null);
	file = $state<{ id: string; name: string } | null>(null);
	uploading = $state(0);
	title = $state('');

	head = $state(true);
	contact = $state(false);
	lpr = $state(false);
	user = $state<{ id: string; name: string } | null>(null);
	order = $state<'sequential' | 'parallel'>('sequential');
	days = $state(7);

	#dealId: string;
	#titleTouched = false;
	/** документ уже создан, но отправка не удалась: повтор не должен плодить дубликаты */
	#created: SignatureDocument | null = null;

	constructor(dealId: string) {
		this.#dealId = dealId;
	}

	get template(): SignatureTemplate | null {
		return this.templates.find((t) => t.code === this.templateCode) ?? null;
	}

	setTitle(value: string) {
		this.title = value;
		this.#titleTouched = true;
	}

	/** Названию по умолчанию можно доверять, пока пользователь не начал печатать своё. */
	#autoTitle() {
		if (this.#titleTouched) return;
		const base = this.source === 'template' ? (this.template?.name ?? '') : (this.file?.name.replace(/\.pdf$/i, '') ?? '');
		this.title = base && this.deal ? `${base} · ${this.deal.number}` : base;
	}

	async load(): Promise<void> {
		this.loading = true;
		this.loadError = null;
		try {
			const [card, templates] = await Promise.all([
				unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: this.#dealId } } })),
				listTemplates()
			]);
			const contactId = card.deal.contact_id ?? null;
			let contactName: string | null = null;
			if (contactId) {
				const c = await api.GET('/api/contacts/{contact_id}', { params: { path: { contact_id: contactId } } }).then((r) => r.data);
				if (c) contactName = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ');
			}
			this.deal = { number: card.deal.number, contactId, contactName, organizationId: card.deal.organization_id ?? null };
			this.templates = templates;
			this.pickTemplate(templates[0]?.code ?? null);
			if (!templates.length) this.source = 'file';
		} catch (e) {
			this.loadError = e;
		} finally {
			this.loading = false;
		}
	}

	pickTemplate(code: string | null) {
		this.templateCode = code;
		const t = this.template;
		if (t) {
			this.days = t.default_deadline_days;
			const roles = t.required_signer_roles as { role?: string; contact_role?: string }[];
			this.head = roles.some((r) => r.role === 'HEAD');
			this.contact = !!this.deal?.contactId && roles.some((r) => !!r.contact_role);
			this.lpr = !this.deal?.contactId && !!this.deal?.organizationId && roles.some((r) => r.contact_role === 'decision_maker');
			if (!this.head && !this.contact && !this.lpr) this.head = true;
		}
		this.#autoTitle();
	}

	setSource(source: 'template' | 'file') {
		this.source = source;
		this.#autoTitle();
	}

	async pickFile(picked: File) {
		this.error = null;
		this.uploading = 0.01;
		try {
			const saved = await uploadFile(picked, { purpose: 'signature', category: 'contract', onProgress: (f) => (this.uploading = Math.max(0.01, f)) });
			this.file = { id: saved.id, name: picked.name };
			this.#autoTitle();
		} catch (e) {
			this.error = e instanceof ApiError ? e.detail : 'Не удалось загрузить файл';
		} finally {
			this.uploading = 0;
		}
	}

	/** В порядке подписания: руководитель → контакт → ЛПР → сотрудник. */
	get signers(): (SignerSpec & { type: 'internal' | 'external' })[] {
		const list: (SignerSpec & { type: 'internal' | 'external' })[] = [];
		if (this.head) list.push({ role: 'HEAD', type: 'internal' });
		if (this.contact && this.deal?.contactId) list.push({ contact_id: this.deal.contactId, type: 'external' });
		if (this.lpr) list.push({ contact_role: 'decision_maker', type: 'external' });
		if (this.user) list.push({ user_id: this.user.id, type: 'internal' });
		return list;
	}

	get warnExternalNotFirst(): boolean {
		return externalNotFirstWarning(this.signers, this.order);
	}

	get sourceReady(): boolean {
		return this.title.trim().length >= 3 && (this.source === 'template' ? !!this.templateCode : !!this.file);
	}

	get canSubmit(): boolean {
		return this.sourceReady && this.signers.length > 0 && this.days >= 1;
	}

	/** Создаёт документ и сразу отправляет. Файл, который ещё проверяется антивирусом, подождём несколько секунд. */
	async submit(): Promise<SignatureDocument | null> {
		if (!this.canSubmit || this.busy) return null;
		this.busy = true;
		this.error = null;
		this.signersError = null;
		try {
			const body = {
				doc_type: (this.source === 'template' ? this.template?.doc_type : 'custom') as 'kp',
				title: this.title.trim(),
				entity_type: 'deal' as const,
				entity_id: this.#dealId,
				template_code: this.source === 'template' ? this.templateCode : null,
				file_id: this.source === 'file' ? (this.file?.id ?? null) : null,
				signers: this.signers.map(({ type: _type, ...spec }) => spec),
				signing_order: this.order,
				deadline_days: this.days
			};
			let created = this.#created;
			for (let attempt = 0; attempt < 6 && !created; attempt += 1) {
				try {
					created = await createDocument(body);
				} catch (e) {
					const scanning = e instanceof ApiError && e.status === 422 && /не прошёл проверку/i.test(e.detail);
					if (!scanning || attempt === 5) throw e;
					await sleep(2000);
				}
			}
			this.#created = created;
			rememberDocument(created!.id, this.#dealId);
			const sent = await sendDocument(created!.id);
			this.#created = null;
			return sent;
		} catch (e) {
			if (e instanceof ApiError && e.fieldError('signers')) this.signersError = e.detail;
			else this.error = e instanceof ApiError ? e.detail : 'Не удалось отправить документ';
			return null;
		} finally {
			this.busy = false;
		}
	}
}
