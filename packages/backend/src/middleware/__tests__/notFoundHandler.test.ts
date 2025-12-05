import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { notFoundHandler } from '../notFoundHandler';

describe('Not Found Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/api/v1/nonexistent',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  it('should call next with 404 error', () => {
    notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(createError.HttpError));
    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Route GET /api/v1/nonexistent not found');
  });

  it('should include method in error message', () => {
    const request = {
      ...mockRequest,
      method: 'POST',
      path: '/api/v1/products',
    };
    
    notFoundHandler(request as Request, mockResponse as Response, mockNext);

    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.message).toContain('POST');
  });

  it('should include path in error message', () => {
    const request = {
      ...mockRequest,
      method: 'DELETE',
      path: '/api/v1/users/123',
    };
    
    notFoundHandler(request as Request, mockResponse as Response, mockNext);

    const error = (mockNext as jest.Mock).mock.calls[0][0];
    expect(error.message).toContain('/api/v1/users/123');
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    
    methods.forEach((method) => {
      jest.clearAllMocks();
      const request = {
        ...mockRequest,
        method,
        path: '/test',
      };
      
      notFoundHandler(request as Request, mockResponse as Response, mockNext);

      const error = (mockNext as jest.Mock).mock.calls[0][0];
      expect(error.message).toContain(method);
    });
  });
});

