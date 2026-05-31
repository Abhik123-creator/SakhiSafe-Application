import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    startTime?: number;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incomingRequestId = req.header('x-request-id');
    const requestId = incomingRequestId?.trim() || `req_${randomUUID()}`;
    req.requestId = requestId;
    req.startTime = Date.now();
    res.setHeader('x-request-id', requestId);
    next();
  }
}
