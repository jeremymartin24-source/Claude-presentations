import cors from 'cors';

export const corsOptions: cors.CorsOptions = {
  origin: true,          // reflect the request origin (allow all)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-password',
    'x-requested-with',
  ],
  exposedHeaders: ['Content-Disposition'],
  optionsSuccessStatus: 200,
};

export const corsMiddleware = cors(corsOptions);
