import { BadgeCheck, Clock, TriangleAlert } from 'lucide-react'
import { VERIFICATION_LABEL } from '../../lib/labels.js'

// tone: neutral | teal | amber | coral | cobalt
export default function Badge({ tone = 'neutral', icon: Icon, className = '', children }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {Icon && <Icon className="badge-glyph" aria-hidden="true" />}
      {children}
    </span>
  )
}

const VERIFICATION = {
  VERIFIED: { tone: 'teal', icon: BadgeCheck },
  PENDING: { tone: 'amber', icon: Clock },
  REPORTED: { tone: 'coral', icon: TriangleAlert },
}

// El estado de verificacion es la promesa central del producto (RF-122):
// siempre con icono y texto, nunca solo con color.
export function VerificationBadge({ status }) {
  const v = VERIFICATION[status] || VERIFICATION.PENDING
  return (
    <Badge tone={v.tone} icon={v.icon}>
      {VERIFICATION_LABEL[status] || VERIFICATION_LABEL.PENDING}
    </Badge>
  )
}
