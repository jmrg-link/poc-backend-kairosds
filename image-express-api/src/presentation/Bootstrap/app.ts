/**
 * Configuración y creación de la aplicación Express
 * @module app
 */
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { AppRoutes } from './routes';
import { errorMiddleware } from './middlewares/errorMiddleware';
import { httpLogger } from './middlewares/logger';
import { envs } from '@config/envs';

/**
 * Crea y configura la aplicación Express
 * @returns {Application} Aplicación configurada
 */
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(httpLogger);

  if (envs.ENABLE_SWAGGER) {
    const swaggerDocument = YAML.load(path.join(__dirname, '../../../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  const router = express.Router();
  new AppRoutes(router);
  app.use('/api', router);

  app.use(errorMiddleware);

  return app;
}
