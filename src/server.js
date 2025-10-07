#!/usr/bin/env node

/**
 * Standalone MCP HTTP Server for Gastos Compartidos
 * Independent deployment with configurable Agent API backend connection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { CONFIG } from './config/environment.js';
import { logger, logStartup, logRequest, logError, logHealthCheck } from './utils/logger.js';
import { apiKeyAuth } from './auth/api-key-auth.js';

// Import tools (these would be copied from the original implementation)
import { ListMySheetsool } from './tools/list-my-sheets.js';
import { GetSheetSummaryTool } from './tools/get-sheet-summary.js';

class StandaloneMCPServer {
  constructor() {
    this.app = express();
    this.rateLimiter = new RateLimiterMemory({
      keyGenerator: (req) => req.ip,
      points: CONFIG.RATE_LIMIT.maxRequests,
      duration: CONFIG.RATE_LIMIT.windowMs / 1000, // seconds
    });

    // Initialize tools
    this.tools = new Map([
      ['list_my_sheets', new ListMySheetsool()],
      ['get_sheet_summary', new GetSheetSummaryTool()],
    ]);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    
    logStartup(CONFIG);
  }

  setupMiddleware() {
    // Security middleware
    if (CONFIG.SECURITY.HELMET_ENABLED) {
      this.app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
      }));
    }

    // Compression
    if (CONFIG.SECURITY.COMPRESSION_ENABLED) {
      this.app.use(compression());
    }

    // CORS configuration
    this.app.use(cors({
      origin: CONFIG.CORS_ORIGINS === '*' ? true : CONFIG.CORS_ORIGINS.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    // Body parsing
    this.app.use(express.json({ 
      limit: '1mb',
      type: ['application/json', 'text/plain']
    }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        logRequest(req, responseTime, res.statusCode);
      });
      
      next();
    });

    // Rate limiting middleware
    this.app.use(async (req, res, next) => {
      try {
        await this.rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          endpoint: req.url,
          environment: CONFIG.NODE_ENV
        });
        
        res.status(429).json({
          error: 'rate_limit_exceeded',
          message: CONFIG.ERRORS.RATE_LIMIT_EXCEEDED,
          retryAfter: Math.round(rejRes.msBeforeNext / 1000)
        });
      }
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        // Test backend connectivity
        const backendTest = await apiKeyAuth.testBackendConnectivity();
        
        const health = {
          status: backendTest.success ? 'healthy' : 'degraded',
          service: CONFIG.MCP.name,
          version: CONFIG.MCP.version,
          timestamp: new Date().toISOString(),
          environment: CONFIG.NODE_ENV,
          tools: Array.from(this.tools.keys()),
          backend: {
            agent_api_url: CONFIG.AGENT_API_URL,
            connectivity: backendTest.success ? 'ok' : 'failed',
            ...(backendTest.error && { error: backendTest.error })
          },
          cache: apiKeyAuth.getCacheStats()
        };

        logHealthCheck(backendTest.success, { backend: backendTest.success });
        
        res.status(backendTest.success ? 200 : 503).json(health);
      } catch (error) {
        logError(error, { endpoint: '/health' });
        res.status(500).json({
          status: 'unhealthy',
          error: 'Health check failed'
        });
      }
    });

    // MCP Schema endpoint for auto-discovery
    this.app.get('/mcp/schema', (req, res) => {
      res.json({
        server: {
          name: CONFIG.MCP.name,
          version: CONFIG.MCP.version,
          description: CONFIG.MCP.description,
          environment: CONFIG.NODE_ENV,
          agent_api_url: CONFIG.AGENT_API_URL
        },
        capabilities: {
          tools: true,
          resources: false,
          prompts: false
        },
        tools: Array.from(this.tools.values()).map(tool => tool.getSchema()),
        authentication: {
          type: 'api_key',
          description: 'Requiere API key en header Authorization como Bearer token',
          header: 'Authorization: Bearer gcp_your_api_key'
        },
        endpoints: {
          health: 'GET /health',
          schema: 'GET /mcp/schema',
          list_tools: 'GET /mcp/tools',
          call_tool: 'POST /mcp/tools/{tool_name}',
          initialize: 'POST /mcp/initialize'
        },
        rate_limiting: {
          window_ms: CONFIG.RATE_LIMIT.windowMs,
          max_requests: CONFIG.RATE_LIMIT.maxRequests
        }
      });
    });

    // List tools endpoint (authenticated)
    this.app.get('/mcp/tools', async (req, res) => {
      try {
        const authData = await this.authenticateRequest(req);
        if (!authData) {
          return res.status(401).json({
            error: 'authentication_required',
            message: CONFIG.ERRORS.AUTHENTICATION_FAILED
          });
        }

        const tools = Array.from(this.tools.values()).map(tool => tool.getSchema());
        
        res.json({
          tools,
          total_count: tools.length,
          user_id: authData.user.id,
          environment: CONFIG.NODE_ENV,
          agent_api_url: CONFIG.AGENT_API_URL
        });

      } catch (error) {
        logError(error, { endpoint: '/mcp/tools' });
        res.status(500).json({
          error: 'server_error',
          message: CONFIG.ERRORS.SERVER_ERROR
        });
      }
    });

    // Execute tool endpoint (authenticated)
    this.app.post('/mcp/tools/:toolName', async (req, res) => {
      const { toolName } = req.params;
      const args = req.body.arguments || req.body.args || {};

      try {
        // Authenticate request
        const authData = await this.authenticateRequest(req);
        if (!authData) {
          return res.status(401).json({
            error: 'authentication_required',
            message: CONFIG.ERRORS.AUTHENTICATION_FAILED
          });
        }

        // Get tool
        const tool = this.tools.get(toolName);
        if (!tool) {
          return res.status(404).json({
            error: 'tool_not_found',
            message: `Tool '${toolName}' not found`,
            available_tools: Array.from(this.tools.keys())
          });
        }

        // Execute tool
        const startTime = Date.now();
        const result = await tool.execute(args, authData.user, authData.keyId);
        const executionTime = Date.now() - startTime;

        logger.info('Tool executed successfully', {
          tool: toolName,
          userId: authData.user.id,
          keyId: authData.keyId,
          executionTime: `${executionTime}ms`,
          environment: CONFIG.NODE_ENV
        });

        res.json({
          success: true,
          tool: toolName,
          result,
          execution_time_ms: executionTime,
          user_id: authData.user.id,
          timestamp: new Date().toISOString(),
          environment: CONFIG.NODE_ENV
        });

      } catch (error) {
        logError(error, {
          tool: toolName,
          args: Object.keys(args),
          endpoint: 'call_tool'
        });

        const statusCode = error.statusCode || 500;
        const errorResponse = {
          success: false,
          error: error.message || 'Tool execution failed',
          tool: toolName,
          timestamp: new Date().toISOString(),
          environment: CONFIG.NODE_ENV
        };

        if (error.details) {
          errorResponse.details = error.details;
        }

        res.status(statusCode).json(errorResponse);
      }
    });

    // MCP Protocol initialize endpoint
    this.app.post('/mcp/initialize', async (req, res) => {
      try {
        const authData = await this.authenticateRequest(req);
        if (!authData) {
          return res.status(401).json({
            error: 'authentication_required',
            message: CONFIG.ERRORS.AUTHENTICATION_FAILED
          });
        }

        res.json({
          protocolVersion: CONFIG.MCP.protocol_version,
          serverInfo: {
            name: CONFIG.MCP.name,
            version: CONFIG.MCP.version,
            environment: CONFIG.NODE_ENV,
            agent_api_url: CONFIG.AGENT_API_URL
          },
          capabilities: {
            tools: {}
          },
          user: {
            id: authData.user.id,
            scopes: authData.scopes
          }
        });

      } catch (error) {
        logError(error, { endpoint: '/mcp/initialize' });
        res.status(500).json({
          error: 'server_error',
          message: CONFIG.ERRORS.SERVER_ERROR
        });
      }
    });

    // Root endpoint with API information
    this.app.get('/', (req, res) => {
      res.json({
        service: CONFIG.MCP.name,
        version: CONFIG.MCP.version,
        description: CONFIG.MCP.description,
        environment: CONFIG.NODE_ENV,
        endpoints: [
          'GET /health - Health check',
          'GET /mcp/schema - API discovery',
          'GET /mcp/tools - List tools (auth required)',
          'POST /mcp/tools/{name} - Execute tool (auth required)'
        ],
        documentation: 'https://github.com/tu-usuario/gastoscompartidos-mcp-server',
        backend: CONFIG.AGENT_API_URL
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'not_found',
        message: `Endpoint ${req.method} ${req.url} not found`,
        available_endpoints: [
          'GET /health',
          'GET /mcp/schema',
          'GET /mcp/tools',
          'POST /mcp/tools/{tool_name}',
          'POST /mcp/initialize'
        ]
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logError(error, {
        method: req.method,
        url: req.url,
        body: req.body
      });

      res.status(error.statusCode || 500).json({
        error: 'server_error',
        message: CONFIG.ERRORS.SERVER_ERROR,
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV
      });
    });
  }

  /**
   * Authenticate HTTP request using API key
   */
  async authenticateRequest(req) {
    try {
      const apiKey = apiKeyAuth.extractAPIKey(req.headers);
      
      if (!apiKey) {
        logger.warn('Request without API key', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.url
        });
        return null;
      }

      const authData = await apiKeyAuth.validateAPIKey(apiKey);
      if (!authData) {
        logger.warn('Request with invalid API key', {
          keyPrefix: apiKeyAuth.getKeyPrefix(apiKey),
          ip: req.ip,
          endpoint: req.url
        });
        return null;
      }

      return authData;

    } catch (error) {
      logError(error, { context: 'HTTP authentication', endpoint: req.url });
      return null;
    }
  }

  async start() {
    try {
      const server = this.app.listen(CONFIG.PORT, CONFIG.HOST, () => {
        logger.info('MCP Server started successfully', {
          port: CONFIG.PORT,
          host: CONFIG.HOST,
          environment: CONFIG.NODE_ENV,
          agentApiUrl: CONFIG.AGENT_API_URL,
          toolsCount: this.tools.size,
          tools: Array.from(this.tools.keys())
        });
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.shutdown(server));
      process.on('SIGTERM', () => this.shutdown(server));

    } catch (error) {
      logError(error, { context: 'Server startup' });
      process.exit(1);
    }
  }

  shutdown(server) {
    logger.info('Shutting down MCP Server...');
    server.close(() => {
      logger.info('MCP Server stopped');
      process.exit(0);
    });
  }
}

// Initialize server instance once so it can be reused across invocations
const server = new StandaloneMCPServer();

// Detect if we are running in a serverless/Vercel environment
const isServerless = Boolean(process.env.VERCEL);

if (!isServerless) {
  server.start().catch(error => {
    logError(error, { context: 'Server initialization' });
    process.exit(1);
  });
} else {
  logger.info('MCP Server initialized in serverless mode', {
    environment: CONFIG.NODE_ENV,
    agentApiUrl: CONFIG.AGENT_API_URL,
    tools: Array.from(server.tools.keys())
  });
}

// Export Express app for serverless runtimes like Vercel
export const app = server.app;
export default server.app;

