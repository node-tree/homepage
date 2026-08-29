import React, { useId } from 'react';

// ════════════════════════════════════════════════════════════════════════
// 폼 원자 — 표찰은 언제나 입력 **위**, 도움말은 아래, 오류는 그 아래(설계 규칙).
//   id 는 useId() 로 만든다(같은 폼을 두 번 그려도 label-for 가 어긋나지 않는다).
// ════════════════════════════════════════════════════════════════════════

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string, invalid: boolean) => React.ReactNode;
  /** 라벨 대신 그룹 제목으로 쓸 때(배열 편집 등) */
  asGroup?: boolean;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, children, asGroup }) => {
  const id = useId();
  const invalid = !!error;
  return (
    <div className="nte-field">
      {asGroup ? (
        <div className="nte-label">{label}</div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      {children(id, invalid)}
      {hint ? <div className="nte-hint">{hint}</div> : null}
      {error ? <div className="nte-err">{error}</div> : null}
    </div>
  );
};

export interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  hint?: string;
  error?: string | null;
}

export const TextInput: React.FC<TextInputProps> = ({ label, hint, error, ...rest }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, invalid) => (
      <input
        {...rest}
        id={id}
        type={rest.type ?? 'text'}
        className={`nte-input${invalid ? ' bad' : ''}`}
        aria-invalid={invalid || undefined}
      />
    )}
  </Field>
);

export interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** 긴 원문(CV) 용 — Mono · 높이 확대 */
  tall?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, hint, error, tall, ...rest }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, invalid) => (
      <textarea
        {...rest}
        id={id}
        className={`nte-textarea${tall ? ' tall' : ''}${invalid ? ' bad' : ''}`}
        aria-invalid={invalid || undefined}
      />
    )}
  </Field>
);

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, hint, error, options, ...rest }) => (
  <Field label={label} hint={hint} error={error}>
    {(id, invalid) => (
      <select {...rest} id={id} className="nte-select" aria-invalid={invalid || undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )}
  </Field>
);
