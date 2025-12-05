import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error | createError.HttpError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let message = err.message;

    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        statusCode = 409;
        message = 'A record with this information already exists';
        break;
      case 'P2025':
        // Record not found
        statusCode = 404;
        message = 'Record not found';
        break;
      case 'P2003':
        // Foreign key constraint failed
        statusCode = 400;
        message = 'Invalid reference to related record';
        break;
      case 'P2014':
        // Required relation violation
        statusCode = 400;
        message = 'Required relation missing';
        break;
      case 'P2021':
        // Table does not exist
        statusCode = 500;
        message = 'Database table not found';
        break;
      case 'P2022':
        // Column does not exist
        statusCode = 500;
        message = 'Database column not found';
        break;
      case 'P1001':
        // Can't reach database server
        statusCode = 503;
        message = 'Database connection failed';
        break;
      case 'P1000':
        // Authentication failed
        statusCode = 503;
        message = 'Database authentication failed';
        break;
      default:
        statusCode = 400;
        message = err.message;
    }

    logger.error('Prisma error occurred:', {
      error: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(statusCode).json({
      error: {
        message,
        statusCode,
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: err.stack,
          prismaCode: err.code,
          prismaMeta: err.meta,
        }),
      },
    });
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error occurred:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(400).json({
      error: {
        message: 'Invalid data provided',
        statusCode: 400,
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: err.stack,
          details: err.message,
        }),
      },
    });
  }

  // Handle Prisma initialization errors (database connection issues)
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Prisma initialization error occurred:', {
      error: err.message,
      errorCode: err.errorCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(503).json({
      error: {
        message: 'Database connection failed. Please try again later.',
        statusCode: 503,
        ...(process.env.NODE_ENV !== 'production' && { 
          stack: err.stack,
          errorCode: err.errorCode,
        }),
      },
    });
  }

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code
  const statusCode = err instanceof createError.HttpError ? err.statusCode : 500;

  // Don't expose internal errors in production
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message;

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}














