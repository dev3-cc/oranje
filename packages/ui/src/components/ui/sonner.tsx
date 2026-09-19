import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--line)',
          '--border-radius': '12px',
          '--success-bg': 'var(--surface)',
          '--success-text': 'var(--ink)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
