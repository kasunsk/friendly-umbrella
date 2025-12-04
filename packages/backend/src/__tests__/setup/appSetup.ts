import express, { Express } from 'express';
import cors from 'cors';
import { setupRoutes } from '../../routes';
import { errorHandler } from '../../middleware/errorHandler';
import { notFoundHandler } from '../../middleware/notFoundHandler';

/**
 * Create Express app for testing (without server)
 */
export function createTestApp(): Express {
  const app = express();

  // CORS configuration
  const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  setupRoutes(app);

  // Error handling middleware (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

