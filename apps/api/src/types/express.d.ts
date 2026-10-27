declare namespace Express {
  interface Request {
    requestId?: string;
    user?: { id: string };
    project?: { id: string; allowedOrigins: string[] };
  }
}
