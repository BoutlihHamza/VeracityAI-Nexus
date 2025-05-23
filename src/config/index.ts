import path from "path";
import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
  prolog: {
    executablePath: path.join(process.env.PROLOG_PATH!, 'swipl.exe'),
    knowledgeBasePath: path.join(__dirname, "../../prolog/knowledge_base.pl"),
    tempDir: path.join(__dirname, "../../temp"),
    timeout: 10000, // 10 seconds
  },
  api: {
    version: "v1",
    prefix: "/api/v1",
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  },
};
