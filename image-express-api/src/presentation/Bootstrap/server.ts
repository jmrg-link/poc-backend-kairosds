import http from 'http';
import { Application } from 'express';
import { createApp } from './app';

/**
 * Crea servidor HTTP con la aplicación
 * @returns {http.Server} Servidor HTTP
 */
export function createServer(): http.Server {
  const app: Application = createApp();
  return http.createServer(app);
}
