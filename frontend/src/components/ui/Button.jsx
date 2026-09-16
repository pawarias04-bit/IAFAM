// Boton unico de la aplicacion. Con `to` se renderiza como <Link> y con
// `href` como <a>, para que un enlace con aspecto de boton no duplique
// estilos.
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'

export default function Button({
  variant = 'primary', // primary | secondary | ghost | danger
  size = 'md',         // sm | md | lg
  icon: Icon,
  loading = false,
  block = false,
  to,
  href,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    block && 'btn-block',
    !children && 'btn-icon-only',
    className,
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {loading
        ? <LoaderCircle className="btn-glyph spin" aria-hidden="true" />
        : Icon && <Icon className="btn-glyph" aria-hidden="true" />}
      {children}
    </>
  )

  if (to) return <Link to={to} className={classes} {...props}>{content}</Link>
  if (href) return <a href={href} className={classes} {...props}>{content}</a>

  return (
    <button
      type="button"
      {...props}
      className={classes}
      disabled={loading || props.disabled}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  )
}
