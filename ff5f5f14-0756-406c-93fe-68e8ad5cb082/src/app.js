const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('apollo-server-express');
const swaggerUi = require('swagger-ui-express');

const logger = require('./utils/logger');
const { initDatabase } = require('./models/db');
const restRoutes = require('./routes/restRoutes');
const { typeDefs, resolvers, getContext } = require('./graphql/schema');
const swaggerSpecs = require('./config/swaggerConfig');

const PORT = process.env.PORT || 3000;

async function startServer() {
  initDatabase();
  logger.info('数据库初始化完成');

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
    next();
  });

  app.use('/api', restRoutes);

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: '血液中心采供血管理系统 API文档'
  }));

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    context: getContext,
    introspection: true,
    playground: {
      settings: {
        'editor.theme': 'light',
        'editor.cursorShape': 'line'
      },
      tabs: [
        {
          endpoint: '/graphql',
          query: `
query InventorySummary {
  inventory_summary {
    blood_type_full
    component_type
    available_quantity
    stock_status
  }
}
          `
        }
      ]
    },
    formatError: (err) => {
      logger.error(`GraphQL错误: ${err.message}`, { stack: err.stack });
      return err;
    }
  });

  await apolloServer.start();
  apolloServer.applyMiddleware({ app, path: '/graphql' });
  logger.info(`GraphQL Playground: http://localhost:${PORT}/graphql`);

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'blood-center-management-system',
      version: '1.0.0',
      endpoints: {
        rest: '/api',
        swagger: '/api-docs',
        graphql: '/graphql'
      }
    });
  });

  app.use((err, req, res, next) => {
    logger.error(`全局异常: ${err.message}`, { stack: err.stack, path: req.path });
    res.status(err.status || 500).json({
      error: err.message || '服务器内部错误',
      request_id: req.headers['x-request-id']
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: '接口不存在', path: req.path, method: req.method });
  });

  const server = app.listen(PORT, () => {
    logger.info(`
╔══════════════════════════════════════════════════════════════╗
║        省级血液中心采供血管理系统后端服务已启动                ║
╠══════════════════════════════════════════════════════════════╣
║  服务端口: ${PORT.toString().padEnd(49)}║
║  REST API: http://localhost:${PORT.toString().padEnd(36)}/api ║
║  Swagger:  http://localhost:${PORT.toString().padEnd(36)}/api-docs ║
║  GraphQL:  http://localhost:${PORT.toString().padEnd(36)}/graphql ║
║  健康检查: http://localhost:${PORT.toString().padEnd(36)}/health ║
╠══════════════════════════════════════════════════════════════╣
║  用户角色ID: 1=采血护士, 2=检验技师, 3=成分制备员,            ║
║             4=库存管理员, 5=配送调度员, 6=医院输血科          ║
║  认证方式: Header X-User-ID: <用户ID>                        ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });

  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，优雅关闭服务');
    server.close(() => {
      process.exit(0);
    });
  });

  return app;
}

if (require.main === module) {
  startServer().catch(err => {
    logger.error('服务启动失败:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
