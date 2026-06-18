import type { ValidationResult, AudioRecording } from '@/types';

interface ValidationRule<T = unknown> {
  validate: (value: T, allValues?: Record<string, unknown>) => boolean;
  message: string;
}

export const required = (message: string = 'required'): ValidationRule<unknown> => ({
  validate: (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  },
  message,
});

export const maxLength = (max: number, message?: string): ValidationRule<string> => ({
  validate: (value) => !value || value.length <= max,
  message: message || `maxLength:${max}`,
});

export const minLength = (min: number, message?: string): ValidationRule<string> => ({
  validate: (value) => !value || value.length >= min,
  message: message || `minLength:${min}`,
});

export const isNumber = (message: string = 'invalidNumber'): ValidationRule<unknown> => ({
  validate: (value) => value === null || value === undefined || !isNaN(Number(value)),
  message,
});

export const range = (
  min: number,
  max: number,
  message?: string,
): ValidationRule<number | string | null | undefined> => ({
  validate: (value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = Number(value);
    return !isNaN(num) && num >= min && num <= max;
  },
  message: message || `range:${min}-${max}`,
});

export const isLatitude = (): ValidationRule<number | string | null | undefined> => ({
  validate: (value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = Number(value);
    return !isNaN(num) && num >= -90 && num <= 90;
  },
  message: 'invalidLatitude',
});

export const isLongitude = (): ValidationRule<number | string | null | undefined> => ({
  validate: (value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = Number(value);
    return !isNaN(num) && num >= -180 && num <= 180;
  },
  message: 'invalidLongitude',
});

export const isValidDate = (message: string = 'invalidDate'): ValidationRule<string | null | undefined> => ({
  validate: (value) => {
    if (!value) return true;
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
  message,
});

export const maxFileSize = (
  maxBytes: number,
  message?: string,
): ValidationRule<File | File[] | null | undefined> => ({
  validate: (value) => {
    if (!value) return true;
    const files = Array.isArray(value) ? value : [value];
    return files.every((file) => file.size <= maxBytes);
  },
  message: message || `fileTooLarge:${maxBytes}`,
});

export const allowedFileTypes = (
  types: string[],
  message: string = 'invalidFileType',
): ValidationRule<File | File[] | null | undefined> => ({
  validate: (value) => {
    if (!value) return true;
    const files = Array.isArray(value) ? value : [value];
    return files.every((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      return types.includes(ext) || types.some((t) => file.type.startsWith(t));
    });
  },
  message,
});

export interface FieldConfig<T> {
  rules?: ValidationRule<T>[];
  label?: string;
}

export type FormSchema<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldConfig<T[K]>;
};

export const validateField = <T>(
  value: T,
  rules: ValidationRule<T>[] | undefined,
  allValues?: Record<string, unknown>,
): string | null => {
  if (!rules) return null;

  for (const rule of rules) {
    if (!rule.validate(value, allValues)) {
      return rule.message;
    }
  }
  return null;
};

export const validateForm = <T extends Record<string, unknown>>(
  values: T,
  schema: FormSchema<T>,
): ValidationResult => {
  const errors: Record<string, string> = {};

  for (const key of Object.keys(schema) as (keyof T)[]) {
    const config = schema[key];
    if (!config) continue;

    const error = validateField(values[key], config.rules, values);
    if (error) {
      errors[key as string] = error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};

export const audioRecordingSchema: FormSchema<Partial<AudioRecording>> = {
  title: {
    rules: [required(), maxLength(200)],
    label: 'title',
  },
  description: {
    rules: [maxLength(2000)],
    label: 'description',
  },
  locationName: {
    rules: [maxLength(200)],
    label: 'locationName',
  },
  latitude: {
    rules: [isLatitude()],
    label: 'latitude',
  },
  longitude: {
    rules: [isLongitude()],
    label: 'longitude',
  },
  administrativeDistrict: {
    rules: [maxLength(100)],
    label: 'administrativeDistrict',
  },
  recordingDevice: {
    rules: [maxLength(100)],
    label: 'recordingDevice',
  },
  lineName: {
    rules: [maxLength(100)],
    label: 'lineName',
  },
  recordedAt: {
    rules: [isValidDate()],
    label: 'recordedAt',
  },
  tags: {
    rules: [],
    label: 'tags',
  },
};

export const validateBatchUpdate = (
  ids: string[],
  updates: Partial<AudioRecording>,
): ValidationResult => {
  const errors: Record<string, string> = {};

  if (ids.length === 0) {
    errors['ids'] = 'noItemsSelected';
  }

  if (Object.keys(updates).length === 0) {
    errors['updates'] = 'noUpdates';
  }

  const fieldValidation = validateForm(updates, audioRecordingSchema);
  Object.assign(errors, fieldValidation.errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};
