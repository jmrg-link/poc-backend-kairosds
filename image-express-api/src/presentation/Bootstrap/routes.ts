/**
 * Configurador de rutas de la aplicación
 * @class AppRoutes
 */
import { Router, Request, Response } from 'express';
import ansiColors from 'ansi-colors';
import { TaskRoutes } from '@presentation/Task/routes/TaskRoutes';

export class AppRoutes {
  constructor(router: Router) {
    this.initializeHealthCheck(router);
    this.initializeV1Routes(router);
  }

  /**
   * Inicializa health check endpoint
   * @private
   * @param {Router} router - Router principal
   */
  private initializeHealthCheck(router: Router): void {
    router.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'image-express-api',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    console.log(ansiColors.green('✓ Health check registered on /api/health'));
  }

  /**
   * Inicializa rutas v1
   * @private
   * @param {Router} router - Router principal
   */
  private initializeV1Routes(router: Router): void {
    const v1Router = Router();
    const routes = [TaskRoutes];

    routes.forEach(route => {
      v1Router.use(route.routes);
      console.log(ansiColors.yellow(`✓ ${route.name} inicializado en /api/v1`));
    });

    router.use('/v1', v1Router);
  }
}
