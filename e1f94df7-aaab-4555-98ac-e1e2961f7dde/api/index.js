import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import db from './config/database.js';
import authRoutes from './routes/auth.js';
import lotRoutes from './routes/lots.js';
import auctionRoutes from './routes/auctions.js';
import settlementRoutes from './routes/settlements.js';
import catalogRoutes from './routes/catalogs.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: '拍卖行管理系统 API',
      version: '1.0.0',
      description: '拍卖行管理系统后端API，包含拍品管理、拍卖会管理、竞拍、结算等功能',
    },
    servers: [{ url: `http://localhost:${PORT}/api` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);
app.use('/api/lots', lotRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'OK', data: { status: 'healthy', timestamp: new Date().toISOString() } });
});

async function loadSeedData() {
  const userCount = db.collection('users').count();
  if (userCount > 0) return;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const seedPath = join(__dirname, 'data', 'seed.json');
  const seedData = JSON.parse(readFileSync(seedPath, 'utf-8'));

  const SALT_ROUNDS = 10;
  for (const user of seedData.users) {
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    db.collection('users').insertOne({ ...user, password: hashedPassword });
  }

  for (const lot of seedData.lots) {
    db.collection('lots').insertOne(lot);
  }

  for (const auction of seedData.auctions) {
    db.collection('auctions').insertOne(auction);
  }

  for (const bid of seedData.bids) {
    db.collection('bids').insertOne(bid);
  }

  for (const settlement of seedData.settlements) {
    db.collection('settlements').insertOne(settlement);
  }

  for (const deposit of seedData.deposits) {
    db.collection('deposits').insertOne(deposit);
  }

  console.log(`✅ 种子数据加载完成: ${seedData.users.length} 用户, ${seedData.lots.length} 拍品, ${seedData.auctions.length} 拍卖会`);
}

app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

loadSeedData().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 拍卖行管理系统 API 已启动`);
    console.log(`   地址: http://localhost:${PORT}`);
    console.log(`   文档: http://localhost:${PORT}/api-docs`);
  });
});

export default app;
