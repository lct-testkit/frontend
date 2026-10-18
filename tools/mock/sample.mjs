// Пример ответа по схеме OpenAPI: из docs/openapi.json строится минимально правильный JSON для любой ручки.
// Мок-стенд (stand.mjs) отдаёт его там, где нет написанной вручную фикстуры, поэтому каждая ручка контракта отвечает формой, которую ждёт клиент.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const loadSpec = () => JSON.parse(readFileSync(resolve(root, 'docs/openapi.json'), 'utf8'));

/** Стабильный UUID по строке: одно и то же имя поля даёт один и тот же id между запросами. */
export function uuidFor(seed) {
	let h = 2166136261;
	const hex = [];
	for (let i = 0; i < 32; i++) {
		h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619) >>> 0;
		hex.push((h >>> 28).toString(16));
	}
	const s = hex.join('');
	return `${s.slice(0, 8)}-${s.slice(8, 12)}-7${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

const MAX_DEPTH = 4;

export function createSampler(spec) {
	const schemas = spec.components?.schemas ?? {};
	const deref = (s) => {
		let cur = s;
		for (let i = 0; cur?.$ref && i < 10; i++) cur = schemas[cur.$ref.split('/').pop()];
		return cur ?? {};
	};

	function merge(parts) {
		const out = { type: 'object', properties: {}, required: [] };
		for (const p of parts) {
			const d = deref(p);
			Object.assign(out.properties, d.properties ?? {});
			out.required.push(...(d.required ?? []));
		}
		return out;
	}

	function pickOne(options) {
		const real = options.map(deref).filter((o) => o.type !== 'null');
		return real[0] ?? options[0];
	}

	function sample(schema, name = 'value', depth = 0) {
		let s = deref(schema);
		if (s.allOf) s = merge(s.allOf);
		if (s.anyOf || s.oneOf) return sample(pickOne(s.anyOf ?? s.oneOf), name, depth);
		if (s.const !== undefined) return s.const;
		if (s.enum) return s.enum[0];
		if (s.default !== undefined && s.default !== null) return s.default;
		const type = Array.isArray(s.type) ? s.type.find((t) => t !== 'null') : s.type;
		switch (type) {
			case 'string':
				if (s.format === 'uuid') return uuidFor(name);
				if (s.format === 'date-time') return '2026-10-18T09:00:00Z';
				if (s.format === 'date') return '2026-10-18';
				if (s.format === 'email') return 'user@example.ru';
				if (s.format === 'uri' || s.format === 'url') return 'http://localhost/example';
				return s.minLength && s.minLength > 6 ? 'x'.repeat(s.minLength) : 'Пример';
			case 'integer':
			case 'number':
				return s.minimum ?? 1;
			case 'boolean':
				return false;
			case 'array':
				return depth >= MAX_DEPTH ? [] : [sample(s.items ?? {}, name, depth + 1)];
			case 'object':
			default: {
				if (!s.properties) return type === 'object' ? {} : null;
				const required = new Set(s.required ?? []);
				const out = {};
				for (const [key, prop] of Object.entries(s.properties)) {
					if (depth >= MAX_DEPTH && !required.has(key)) continue;
					// конец списка: иначе «Пример» как курсор заставил бы клиент листать бесконечно
					out[key] = key === 'next_cursor' ? null : sample(prop, key, depth + 1);
				}
				return out;
			}
		}
	}

	/** Схема тела ответа 2xx: { status, type, schema } — первая успешная (201 раньше 200 не берём: порядок как в спеке). */
	function responseOf(operation) {
		const codes = Object.keys(operation.responses ?? {})
			.filter((c) => /^2/.test(c))
			.sort();
		const status = Number(codes[0] ?? 200);
		const content = operation.responses?.[codes[0]]?.content ?? {};
		const type = Object.keys(content)[0] ?? null;
		return { status, type, schema: type ? content[type].schema : null };
	}

	/** Схема — конверт списка (`items` массив): такие ответы в режиме `empty` и `error` подменяются. */
	function isList(schema) {
		const s = schema ? deref(schema) : null;
		return Boolean(s?.properties?.items && deref(s.properties.items).type === 'array');
	}

	return { sample, responseOf, isList, deref };
}

/** Проверка значения по схеме: обязательные поля, типы, перечисления (глубже 6 уровней не идёт). Возвращает список расхождений. */
export function conforms(spec, schema, value, path = '$', depth = 0) {
	const { deref } = createSampler(spec);
	let s = deref(schema);
	const problems = [];
	if (depth > 6) return problems;
	if (s.allOf) {
		for (const part of s.allOf) problems.push(...conforms(spec, part, value, path, depth + 1));
		return problems;
	}
	if (s.anyOf || s.oneOf) {
		const options = s.anyOf ?? s.oneOf;
		const ok = options.some((o) => conforms(spec, o, value, path, depth + 1).length === 0);
		return ok ? [] : [`${path}: не подходит ни один вариант схемы`];
	}
	if (value === null) return s.type === 'null' || s.nullable || s.type === undefined ? [] : [`${path}: null`];
	if (s.enum && !s.enum.includes(value)) problems.push(`${path}: ${JSON.stringify(value)} не из перечисления`);
	const kind = Array.isArray(value) ? 'array' : typeof value;
	const want = s.type;
	if (want === 'integer' && !Number.isInteger(value)) problems.push(`${path}: ждали целое`);
	else if (want === 'number' && kind !== 'number') problems.push(`${path}: ждали число`);
	else if (want === 'string' && kind !== 'string') problems.push(`${path}: ждали строку`);
	else if (want === 'boolean' && kind !== 'boolean') problems.push(`${path}: ждали boolean`);
	else if (want === 'array') {
		if (kind !== 'array') problems.push(`${path}: ждали массив`);
		else value.forEach((v, i) => problems.push(...conforms(spec, s.items ?? {}, v, `${path}[${i}]`, depth + 1)));
	} else if (want === 'object' || s.properties) {
		if (kind !== 'object') problems.push(`${path}: ждали объект`);
		else {
			for (const key of s.required ?? []) if (!(key in value)) problems.push(`${path}.${key}: нет обязательного поля`);
			for (const [key, prop] of Object.entries(s.properties ?? {})) if (key in value) problems.push(...conforms(spec, prop, value[key], `${path}.${key}`, depth + 1));
		}
	}
	return problems;
}
