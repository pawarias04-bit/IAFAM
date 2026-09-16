// Logo de la empresa o, si no tiene, un monograma con color estable
// (el mismo nombre siempre produce el mismo color).
const TINTS = ['teal', 'cobalt', 'amber', 'coral', 'sage']

function tintFor(name = '') {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[hash % TINTS.length]
}

function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
}

export default function CompanyMark({ name, logoUrl, size = 'md' }) {
  if (logoUrl) {
    return <img className={`company-mark company-mark-${size}`} src={logoUrl} alt="" />
  }
  return (
    <span className={`company-mark company-mark-${size} tint-${tintFor(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
