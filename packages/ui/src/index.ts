/**
 * Única superficie pública de @oranje/ui.
 *
 * Los estilos NO se exportan por aquí: se importan por su ruta
 * (`@oranje/ui/styles/tokens.css`) desde el `globals.css` de cada app.
 */
export { cn } from './lib/utils'
export { KpiCard, type KpiCardProps } from './components/KpiCard'
export { StatusLightBadge, type StatusLightBadgeProps } from './components/StatusLightBadge'
export { MaterialIcon } from './components/material-icon'
export { DataTable } from './components/DataTable'
export type { ColumnDef } from '@tanstack/react-table'

/**
 * Primitivas copiadas de shadcn/ui (D-16): tematizadas vía `shadcn-vars.css`
 * —derivado de los tokens Oranje— e iconografía Material. Se re-exportan aquí
 * porque la superficie pública del paquete es una sola (§6).
 */
export { Skeleton } from './components/ui/skeleton'
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table'
export { Button as UiButton, buttonVariants } from './components/ui/button'
export { Badge, badgeVariants } from './components/ui/badge'
export { Input } from './components/ui/input'
export { Textarea } from './components/ui/textarea'
export { Label } from './components/ui/label'
export { Checkbox } from './components/ui/checkbox'
export { Slider } from './components/ui/slider'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from './components/ui/form'
export * from '../tokens'
