/**
 * Configuración de base de datos
 * @interface DatabaseConfig
 */
export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: Record<string, unknown>;
}
