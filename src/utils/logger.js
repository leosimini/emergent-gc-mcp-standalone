/**
 * Logging utility for MCP Server
 */

import winston from 'winston';
import path from 'path';
import { CONFIG } from '../config/environment.js';

// Ensure logs directory exists
import fs from 'fs';
const logsDir = path.dirname(CONFIG.LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create logger instance
export const logger = winston.createLogger({
  level: CONFIG.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, userId, keyId, tool, environment, ...meta }) => {
      const logEntry = {
        timestamp,
        level,
        message,
        environment: CONFIG.NODE_ENV,
        ...(userId && { userId }),
        ...(keyId && { keyId }),
        ...(tool && { tool }),
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  transports: [
    // Console output with colors for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, userId, keyId, tool, environment }) => {
          let logMsg = `${timestamp} [${level}] ${message}`;
          if (environment && environment !== 'production') logMsg += ` [${environment}]`;
          if (userId) logMsg += ` (user: ${userId})`;
          if (keyId) logMsg += ` (key: ${keyId})`;
          if (tool) logMsg += ` (tool: ${tool})`;
          return logMsg;
        })
      )
    }),
    
    // File output for production
    new winston.transports.File({
      filename: CONFIG.LOG_FILE,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    
    // Error file for critical issues
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 3,
    })
  ]
});

/**
 * Log MCP tool usage with structured data
 */
export function logToolUsage(toolName, userId, keyId, params = {}, success = true, responseTime = 0, agentApiUrl = null) {
  logger.info('MCP Tool Usage', {
    tool: toolName,
    userId,
    keyId,
    success,
    responseTime: `${responseTime}ms`,
    params: Object.keys(params),
    agentApiUrl: agentApiUrl || CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV
  });
}

/**
 * Log authentication events with backend info
 */
export function logAuth(event, userId = null, keyId = null, success = true, details = {}) {
  logger.info(`Auth: ${event}`, {
    userId,
    keyId,
    success,
    agentApiUrl: CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV,
    ...details
  });
}

/**
 * Log security events with enhanced context
 */
export function logSecurity(event, userId = null, keyId = null, severity = 'medium', details = {}) {
  const logLevel = severity === 'high' ? 'warn' : 'info';
  logger[logLevel](`Security: ${event}`, {
    userId,
    keyId,
    severity,
    agentApiUrl: CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV,
    ...details
  });
}

/**
 * Log errors with full context
 */
export function logError(error, context = {}) {
  logger.error('MCP Server Error', {
    error: error.message,
    stack: error.stack,
    agentApiUrl: CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV,
    ...context
  });
}

/**
 * Log HTTP requests
 */
export function logRequest(req, responseTime = null, statusCode = null) {
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent')?.substring(0, 100);
  
  logger.info('HTTP Request', {
    method,
    url,
    ip,
    userAgent,
    ...(responseTime && { responseTime: `${responseTime}ms` }),
    ...(statusCode && { statusCode }),
    environment: CONFIG.NODE_ENV
  });
}

/**
 * Log backend API calls
 */
export function logBackendCall(endpoint, method, success, responseTime, statusCode, error = null) {
  logger.info('Backend API Call', {
    endpoint,
    method,
    success,
    responseTime: `${responseTime}ms`,
    statusCode,
    agentApiUrl: CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV,
    ...(error && { error: error.message })
  });
}

/**
 * Log startup information
 */
export function logStartup(config) {
  logger.info('MCP Server Starting', {
    version: config.MCP.version,
    port: config.PORT,
    environment: config.NODE_ENV,
    agentApiUrl: config.AGENT_API_URL,
    corsOrigins: config.CORS_ORIGINS,
    logLevel: config.LOG_LEVEL
  });
}

/**
 * Log health check results
 */
export function logHealthCheck(healthy, services = {}) {
  const level = healthy ? 'info' : 'warn';
  logger[level]('Health Check', {
    healthy,
    services,
    agentApiUrl: CONFIG.AGENT_API_URL,
    environment: CONFIG.NODE_ENV
  });
}

export default logger;