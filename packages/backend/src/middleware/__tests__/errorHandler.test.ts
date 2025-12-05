import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { errorHandler } from '../errorHandler';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    mockRequest = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  it('should handle HttpError correctly', () => {
    const error = createError(404, 'Not Found');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: 'Not Found',
        statusCode: 404,
        stack: expect.any(String),
      },
    });
  });

  it('should handle generic Error correctly', () => {
    const error = new Error('Something went wrong');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: 'Something went wrong',
        statusCode: 500,
        stack: expect.any(String),
      },
    });
  });

  it('should hide internal error messages in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Internal server error');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: 'Internal Server Error',
        statusCode: 500,
      },
    });
    expect(mockResponse.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.anything(),
        }),
      })
    );
  });

  it('should include stack trace in non-production', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Test error');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.any(String),
        }),
      })
    );
  });

  it('should delegate to default handler if headers already sent', () => {
    mockResponse.headersSent = true;
    const error = createError(500, 'Server Error');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should log error details correctly', () => {
    const error = createError(400, 'Bad Request');
    errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(logger.error).toHaveBeenCalledWith('Error occurred:', {
      error: 'Bad Request',
      stack: expect.any(String),
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    });
  });

  it('should handle errors with different status codes', () => {
    const statusCodes = [400, 401, 403, 404, 409, 422, 500];
    
    statusCodes.forEach((statusCode) => {
      jest.clearAllMocks();
      const error = createError(statusCode, `Error ${statusCode}`);
      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            statusCode,
            message: `Error ${statusCode}`,
          }),
        })
      );
    });
  });
});

