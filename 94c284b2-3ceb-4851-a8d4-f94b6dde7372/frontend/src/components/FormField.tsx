import { useState, ChangeEvent, FocusEvent } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => string | null;
  type?: 'text' | 'password' | 'email' | 'tel' | 'date' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: Option[];
  error?: string;
  className?: string;
  hint?: string;
}

export default function FormField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required = false,
  options = [],
  error: externalError,
  className = '',
  hint,
}: Props) {
  const [touched, setTouched] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const error = externalError || internalError;

  const handleBlur = (e: FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setTouched(true);
    if (onBlur) {
      const err = onBlur(e.target.value);
      setInternalError(err);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (touched && onBlur) {
      const err = onBlur(e.target.value);
      setInternalError(err);
    }
  };

  const inputClass = `input ${error ? 'input-error' : ''} ${className}`;

  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-danger-500 ml-0.5">*</span>}
      </label>
      {type === 'select' ? (
        <select
          className={inputClass}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        >
          <option value="">{placeholder || '请选择'}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          className={inputClass}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type={type}
          className={inputClass}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
        />
      )}
      {error ? (
        <p className="mt-1 text-xs text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
