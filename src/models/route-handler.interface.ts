import { NextFunction, Request, Response } from 'express';

export interface RouteListenOptions {
	method: string;
	path: string;
	handler: (request: Request, response: Response, next: NextFunction) => void;
	validators?: any[];
}
