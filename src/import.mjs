import { createHash } from 'node:crypto';
export const MAX_IMPORT = 50 * 1024 * 1024;
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 24);
const date = value => {
  if (value == null || value === '') return null;
  const d = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isNaN(d.valueOf()) ? null : d.toISOString();
};
const text = content => {
  if (typeof content === 'string') return content;
  if (!content) return '';
  if (Array.isArray(content)) return content.map(text).filter(Boolean).join('\n');
  if (content.type === 'thinking' || content.type === 'tool_use' || content.type === 'tool_result') return '';
  if (typeof content.text === 'string') return content.text;
  if (content.parts) return text(content.parts);
  if (content.asset_pointer || content.image_url || content.type === 'image') return '[Image reference; image bytes not imported]';
  return '';
};
const refs = a => (Array.isArray(a) ? a : []).map(x => ({
  name: String(x.file_name ?? x.filename ?? x.name ?? x.id ?? 'Attachment').slice(0, 500),
  available: false,
}));
function finish(source, item, messages, warnings = []) {
  const title = String(item.title ?? item.name ?? '').trim().slice(0, 500) || 'Untitled session';
  const sourceId = String(item.id ?? item.uuid ?? item.conversation_id ?? hash(JSON.stringify(item)));
  const createdAt = date(item.create_time ?? item.created_at);
  const updatedAt = date(item.update_time ?? item.updated_at) ?? createdAt;
  return { id: source + '-' + hash(sourceId), source, sourceId, title, createdAt, updatedAt,
    messages: messages.filter(m => m.text || m.attachments?.length), warnings };
}
function chatgpt(c) {
  const mapping = c.mapping;
  if (!mapping || typeof mapping !== 'object') throw Error('ChatGPT conversation is missing mapping.');
  let cursor = c.current_node;
  const warnings = [];
  if (!cursor || !mapping[cursor]) {
    const leaves = Object.entries(mapping).filter(([, n]) => !n.children?.length);
    leaves.sort((a, b) => (b[1].message?.create_time ?? 0) - (a[1].message?.create_time ?? 0) || a[0].localeCompare(b[0]));
    cursor = leaves[0]?.[0];
    warnings.push('No valid current_node; selected the most recent leaf branch.');
  }
  const nodes = [], seen = new Set();
  while (cursor) {
    if (seen.has(cursor)) throw Error('ChatGPT export contains a cyclic message tree.');
    seen.add(cursor);
    const n = mapping[cursor];
    if (!n) { warnings.push('A parent message is missing from this export.'); break; }
    nodes.unshift(n);
    cursor = n.parent;
  }
  if (Object.values(mapping).filter(n => n.message).length > nodes.filter(n => n.message).length)
    warnings.push('Only the selected conversation branch was imported; alternative branches were excluded.');
  const messages = nodes.flatMap(n => {
    const m = n.message, role = m?.author?.role;
    if (!m || !['user', 'assistant'].includes(role) || m.metadata?.is_visually_hidden_from_conversation) return [];
    return [{ role, text: text(m.content), timestamp: date(m.create_time), attachments: refs(m.metadata?.attachments) }];
  });
  return finish('chatgpt', c, messages, warnings);
}
function claude(c) {
  return finish('claude', c, c.chat_messages.map(m => ({
    role: m.sender === 'human' || m.role === 'user' ? 'user' : 'assistant',
    text: text(m.text) || text(m.content), timestamp: date(m.created_at),
    attachments: refs([...(m.attachments ?? []), ...(m.files ?? [])]),
  })));
}
export function parseImport(content, filename = 'conversations.json') {
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_IMPORT) throw Error('Import must be text, at most 50 MB.');
  if (/\.(md|txt)$/i.test(filename)) {
    if (!content.trim()) throw Error('The document is empty.');
    const title = content.match(/^#\s+(.+)$/m)?.[1] ?? filename.replace(/^.*[\\/]/, '');
    return [finish('document', { id: hash(filename + '\n' + content), title }, [{ role: 'document', text: content, timestamp: null, attachments: [] }],
      ['Imported as a document; message roles and source timestamps are not inferred.'])];
  }
  if (!/\.json$/i.test(filename)) throw Error('Choose conversations.json, a Markdown file, or a text file. Extract ZIP exports first.');
  let data;
  try { data = JSON.parse(content.replace(/^\uFEFF/, '')); } catch { throw Error('The file is not valid JSON.'); }
  const items = Array.isArray(data) ? data : Array.isArray(data?.conversations) ? data.conversations : [data];
  if (!items.length) throw Error('No conversations found.');
  if (items.length > 10000) throw Error('Import at most 10,000 conversations at a time.');
  return items.map((c, i) => {
    if (c?.mapping) return chatgpt(c);
    if (Array.isArray(c?.chat_messages)) return claude(c);
    throw Error('Unrecognized conversation format at item ' + (i + 1) + '. Expected a ChatGPT or Claude export.');
  });
}
