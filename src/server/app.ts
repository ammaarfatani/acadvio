import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import masterRouter from "./routes/index";
import { errorHandler } from "./middlewares/error.middleware";
import { env } from "./config/env";
import { requestSafety } from "./middlewares/requestSafety.middleware";

export const createApp = (): Express => {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  const allowedOrigins = env.NODE_ENV === "production" ? [env.FRONTEND_URL] : [env.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"];
  const proxyHops = process.env.TRUST_PROXY_HOPS;
  if (proxyHops && /^[12]$/.test(proxyHops)) app.set("trust proxy", Number(proxyHops));

  // 1. Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // 2. CORS Configuration
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Acadivo-Branch"],
      exposedHeaders:["Content-Disposition","Content-Length","X-Report-Records"],
    })
  );

  // 3. Global Rate Limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests from this IP, please try again after 15 minutes.",
      errors: ["Rate limit exceeded."],
    },
  });

  app.use("/api", apiLimiter);
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    const origin = req.get("Origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ success: false, message: "This request origin is not allowed." });
    }
    next();
  });

  // 4. Parsers
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());
  app.use("/api", requestSafety);

  // 5. Mount API Routes
  app.use("/api", masterRouter);

  // 6. 404 Route Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "The requested resource was not found.",
      errors: ["Resource not found."],
    });
  });

  // 7. Central Error Handling Middleware
  app.use(errorHandler);

  return app;
};
