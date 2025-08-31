import cors from 'cors';

/**
 * Configuración CORS
 * @constant
 */
export const corsOptions = cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-API-Key'],
});
