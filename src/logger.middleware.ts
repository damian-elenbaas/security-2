import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const method = req.method;
    const endpoint = req.originalUrl;
    const user = res.locals.token?.id || 'unauthorized';

    logger.info(`${method} on ${endpoint} called by ${user}`);
    next();
  }
}