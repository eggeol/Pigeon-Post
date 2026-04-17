import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { config } from "./lib/config.js";
import { AppError } from "./lib/errors.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { usersRouter } from "./routes/users.js";
import { messagesRouter } from "./routes/messages.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const clientDistPath = path.resolve(dirname, "../client");
const clientIndexPath = path.join(clientDistPath, "index.html");

export const app = express();

app.set("trust proxy", 1);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true
  });
});

app.use("/api", authRouter);
app.use("/api", profileRouter);
app.use("/api", usersRouter);
app.use("/api", messagesRouter);

app.use("/api", (_request, _response, next) => {
  next(new AppError(404, "That route flew off the map."));
});

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("/{*splat}", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(clientIndexPath);
  });
}

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: error.issues[0]?.message ?? "That request was malformed."
      });
      return;
    }

    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        error: error.message
      });
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      response.status(404).json({
        error: "That record no longer exists."
      });
      return;
    }

    console.error(error);
    response.status(500).json({
      error: "A wayward pigeon caused an unexpected server error."
    });
  }
);
