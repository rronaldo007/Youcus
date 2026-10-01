import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { InlineMessage } from '@/components/ui/InlineMessage'

export type FieldStatus = 'error' | 'success'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string
  /** Error or success: a coloured 2 px line and the message under the field. */
  status?: FieldStatus
  /** The line under the field; shown as « info » when there is no status (the disabled reason). */
  message?: ReactNode
}

const LINES: Record<FieldStatus | 'default', string> = {
  default: 'border border-line focus:border-2 focus:border-line-strong',
  error: 'border-2 border-error',
  success: 'border-2 border-success',
}

/**
 * Figma « Champ » 5:212: 40 px high, lower than the 44 px button « pour ne jamais les confondre ».
 * The asterisk comes BEFORE the label. Focus is a 2 px ink line; error and success colour the line
 * and say why under the field.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, status, message, required, disabled, id, className = '', ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="flex gap-1 text-label-14 font-semibold text-content">
        {required && (
          <span aria-hidden="true" className="text-accent-text">
            *
          </span>
        )}
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        required={required}
        disabled={disabled}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={message ? messageId : undefined}
        className={`h-10 w-full rounded-yc-md bg-surface px-3 text-body-15 text-content outline-none placeholder:text-content-muted disabled:bg-sunken disabled:text-content-muted ${
          disabled ? 'border border-line' : LINES[status ?? 'default']
        }`}
        {...props}
      />
      {message && (
        <InlineMessage id={messageId} tone={status ?? 'info'}>
          {message}
        </InlineMessage>
      )}
    </div>
  )
})
