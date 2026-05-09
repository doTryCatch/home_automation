import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import scheduleService from './services/schedule.service';
import { webSocketService } from './utils';

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Connected to database');

    const server = createServer(app);

    webSocketService.initialize(server);

    scheduleService.start();

    server.listen(config.port, () => {
      console.log(`
        ===================================================
        Home Automation Server running on port ${config.port}
        ===================================================
      `);
      console.log(`Environment: ${config.node_env}`);
      console.log(`API URL: http://localhost:${config.port}`);
      console.log(`WebSocket: ws://localhost:${config.port}/ws`);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      scheduleService.stop();
      await prisma.$disconnect();
      server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down...');
      scheduleService.stop();
      await prisma.$disconnect();
      server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
