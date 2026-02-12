import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, x-firebase-uid');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple logging for Vercel
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Register your routes (must await - seeds templates and sets up vendor system)
let setupError: Error | null = null;
const setupPromise = registerRoutes(app)
  .then(() => {
    // Error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });
  })
  .catch((err) => {
    console.error("Setup failed:", err);
    setupError = err;
  });

// Export for Vercel - wrap in handler that awaits setup
const handler = async (req: any, res: any) => {
  await setupPromise;
  if (setupError) {
    return res.status(500).json({
      error: "Server setup failed",
      message: setupError.message,
      stack: setupError.stack
    });
  }
  return app(req, res);
};

export default handler;
