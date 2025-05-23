// src/server.ts
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config";
import { logger } from "./utils/logger";
import { evaluationRoutes } from "./routes/evaluationRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { rateLimiter } from "./middleware/rateLimiter";

class Server {
  private app: Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    //  configuration
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Logging
    this.app.use(
      morgan("combined", {
        stream: { write: (message) => logger.info(message.trim()) },
      })
    );
    this.app.use(requestLogger);

    // Rate limiting
    this.app.use(rateLimiter);
  }

  private setupRoutes(): void {
    // API routes
    this.app.use(config.api.prefix, evaluationRoutes);

    // Root endpoint
    this.app.get("/", (req, res) => {
      res.json({
        success: true,
        message: "AI Expert System API",
        version: "1.0.0",
        endpoints: {
          evaluate: `${config.api.prefix}/evaluate`,
          testScenarios: `${config.api.prefix}/evaluate/test`,
          batchEvaluate: `${config.api.prefix}/evaluate/batch`,
          health: `${config.api.prefix}/health`,
        },
      });
    });

    // 404 handler
    // this.app.use("/*", (req, res) => {
    //   res.status(404).json({
    //     success: false,
    //     error: "Endpoint not found",
    //     path: req.originalUrl,
    //   });
    // });
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public start(): void {
    this.app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(
        `API base URL: http://localhost:${config.port}${config.api.prefix}`
      );
    });
  }

  public getApp(): Application {
    return this.app;
  }
}

// Start the server
if (require.main === module) {
  const server = new Server();
  server.start();
}

export default Server;
