'use client';
// Lightweight, dependency-free markdown renderer styled with the glass tokens.
// Handles headings, bold/italic, inline code, fenced code blocks, bullet + numbered
// lists, blockquotes, horizontal rules, links, and strikethrough — enough for chat.

const CODE_INLINE = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88em', background: 'var(--glass-hi)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' };
const LINK = { color: 'var(--accent-soft)', textDecoration: 'underline', wordBreak: 'break-word' };

function renderInline(text) {
  const nodes = [];
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)/;
  let rest = text, k = 0;
  while (rest) {
    const m = rest.match(pattern);
    if (!m) { nodes.push(rest); break; }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok[0] === '`') nodes.push(<code key={k} style={CODE_INLINE}>{tok.slice(1, -1)}</code>);
    else if (tok[0] === '[') { const l = tok.match(/\[([^\]]+)\]\(([^)\s]+)\)/); nodes.push(<a key={k} href={l[2]} target="_blank" rel="noopener noreferrer" style={LINK}>{l[1]}</a>); }
    else if (tok.startsWith('**') || tok.startsWith('__')) nodes.push(<strong key={k}>{renderInline(tok.slice(2, -2))}</strong>);
    else if (tok.startsWith('~~')) nodes.push(<span key={k} style={{ textDecoration: 'line-through', opacity: 0.65 }}>{tok.slice(2, -2)}</span>);
    else nodes.push(<em key={k}>{renderInline(tok.slice(1, -1))}</em>);
    rest = rest.slice(m.index + tok.length); k++;
  }
  return nodes;
}

function parseBlocks(src) {
  const lines = (src || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const isUL = l => /^\s*[-*+]\s+/.test(l);
  const isOL = l => /^\s*\d+[.)]\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++;
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2] }); i++; continue; }
    if (/^(\*\*\*|---|___)\s*$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push({ type: 'quote', text: buf.join('\n') });
      continue;
    }
    if (isUL(line)) {
      const items = [];
      while (i < lines.length && isUL(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (isOL(line)) {
      const items = [];
      while (i < lines.length && isOL(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push({ type: 'ol', items });
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i].trim()) && !/^#{1,6}\s/.test(lines[i]) && !isUL(lines[i]) && !isOL(lines[i]) && !/^>\s?/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    blocks.push({ type: 'p', text: buf.join('\n') });
  }
  return blocks;
}

function Block({ b }) {
  switch (b.type) {
    case 'heading': {
      const size = b.level <= 1 ? 17 : b.level === 2 ? 15.5 : 14.5;
      return <div style={{ fontSize: size, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, margin: '2px 0' }}>{renderInline(b.text)}</div>;
    }
    case 'code':
      return <pre style={{ margin: 0, background: 'var(--glass-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', overflowX: 'auto' }}><code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>{b.text}</code></pre>;
    case 'ul':
      return <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, j) => <li key={j} style={{ lineHeight: 1.5 }}>{renderInline(it)}</li>)}</ul>;
    case 'ol':
      return <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, j) => <li key={j} style={{ lineHeight: 1.5 }}>{renderInline(it)}</li>)}</ol>;
    case 'quote':
      return <div style={{ borderLeft: '3px solid var(--border-hi)', paddingLeft: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{renderInline(b.text)}</div>;
    case 'hr':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />;
    default:
      return <div style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderInline(b.text)}</div>;
  }
}

export default function Markdown({ text }) {
  const blocks = parseBlocks(text);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{blocks.map((b, i) => <Block key={i} b={b} />)}</div>;
}
