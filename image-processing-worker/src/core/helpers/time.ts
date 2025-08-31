/**
 * Tiempo de inicio de la aplicación en zona horaria local
 * @constant
 */
export const startupTimeLocal = new Date().toLocaleString('es-ES', {
  timeZone: 'Europe/Madrid',
  hour12: false,
});

/**
 * Tiempo de inicio de la aplicación en UTC
 * @constant
 */
export const startupTimeUTC = new Date().toISOString();

/**
 * Formatea una fecha a string ISO
 * @param {Date} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}
