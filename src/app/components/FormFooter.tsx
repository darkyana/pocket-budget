export function FormFooter({
  secondary,
  submitLabel,
  submitDisabled,
}: {
  secondary?: { label: string; onClick(): void }
  submitLabel: string
  submitDisabled?: boolean
}) {
  return (
    <div className="form-btns">
      {secondary && (
        <button type="button" className="btn-ghost" onClick={secondary.onClick}>
          {secondary.label}
        </button>
      )}
      <button type="submit" className="btn-primary" disabled={submitDisabled}>
        {submitLabel}
      </button>
    </div>
  )
}
