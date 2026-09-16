// Superficie de cristal. `strong` sube la opacidad para zonas con mucho
// texto (formularios, descripciones), donde el fondo no debe competir.
// `flush` quita el padding para listas y tablas que llegan al borde.
export default function GlassPanel({
  as: Tag = 'div',
  strong = false,
  flush = false,
  className = '',
  children,
  ...props
}) {
  const classes = [
    'glass',
    strong && 'glass-strong',
    flush && 'glass-flush',
    className,
  ].filter(Boolean).join(' ')

  return <Tag className={classes} {...props}>{children}</Tag>
}
