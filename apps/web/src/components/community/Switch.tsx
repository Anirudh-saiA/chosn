'use client';

/** Accessible on/off switch: a real button with role="switch" + aria-checked, labelled by its own text. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <div>
        <p id={`${id}-label`} className="text-body font-semibold text-text">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 max-w-[52ch] text-meta text-text-soft">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={onChange}
        className={`relative mt-0.5 inline-flex h-7 w-[3.25rem] shrink-0 items-center border transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'border-brass/60 bg-brass/20' : 'border-text/20 bg-vault-deep'
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-[3px] h-[1.125rem] w-[1.125rem] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-[1.5rem] bg-brass-bright shadow-[0_0_12px_rgba(255,210,77,.6)]' : 'translate-x-0 bg-text-soft'
          }`}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
