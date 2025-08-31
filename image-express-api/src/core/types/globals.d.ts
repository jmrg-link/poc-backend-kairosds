/**
 * Tipo nullable
 * @template T
 */
export type Nullable<T> = T | null;

/**
 * Tipo opcional
 * @template T
 */
export type Optional<T> = T | undefined;

/**
 * Registro genérico
 * @template T
 */
export type GenericRecord<T = unknown> = Record<string, T>;
