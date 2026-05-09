import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware';
import * as routes from './routes';

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: {
      name: config.app.name,
      version: config.app.version,
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Home Automation API',
    data: {
      name: config.app.name,
      version: config.app.version,
      endpoints: {
        auth: '/api/auth',
        floors: '/api/floors',
        rooms: '/api/rooms',
        devices: '/api/devices',
        schedules: '/api/schedules',
        esp: '/api/esp',
      },
    },
  });
});

app.use('/api/auth', routes.authRoutes);
app.use('/api/floors', routes.floorRoutes);
app.use('/api/rooms', routes.roomRoutes);
app.use('/api/devices', routes.deviceRoutes);
app.use('/api/schedules', routes.scheduleRoutes);
app.use('/api/esp', routes.espRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
