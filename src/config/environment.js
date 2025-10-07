/**
 * Environment Configuration for MCP Server
 * Handles different deployment environments and Agent API connections
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Predefined environments for Agent API
const AGENT_API_ENVIRONMENTS = {
  development: 'https://expense-wizard-103.preview.emergentagent.com',
  staging: 'https://staging.gastoscompartidos.ai',
  production: 'https://gastoscompartidos.ai'
};

// Environment detection
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 8080;

// Agent API URL with fallback logic
const getAgentApiUrl = () => {
  // 1. Use explicit AGENT_API_URL if provided
  if (process.env.AGENT_API_URL) {
    return process.env.AGENT_API_URL;
  }
  
  // 2. Use environment-based URL
  if (AGENT_API_ENVIRONMENTS[NODE_ENV]) {
    return AGENT_API_ENVIRONMENTS[NODE_ENV];
  }
  
  // 3. Default to development
  return AGENT_API_ENVIRONMENTS.development;
};

export const CONFIG = {
  // Environment
  NODE_ENV,
  PORT,
  
  // Agent API Configuration
  AGENT_API_URL: getAgentApiUrl(),
  AGENT_API_PREFIX: '/api/agent/v1',
  API_KEY_VALIDATION_ENDPOINT: '/api/mcp/validate-key',
  
  // Server Configuration
  HOST: process.env.HOST || '0.0.0.0',
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  
  // Rate Limiting
  RATE_LIMIT: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_FILE: process.env.LOG_FILE || 'logs/mcp-server.log',
  
  // MCP Protocol
  MCP: {
    name: 'gastoscompartidos-mcp-server',
    version: '1.0.0',
    description: 'MCP Server for Gastos Compartidos - Manage your shared expenses via LLM agents',
    protocol_version: '1.0.0'
  },
  
  // Tool Configuration
  TOOLS: {
    DEFAULT_LIMIT: parseInt(process.env.TOOLS_DEFAULT_LIMIT) || 20,
    MAX_LIMIT: parseInt(process.env.TOOLS_MAX_LIMIT) || 100,
    MAX_TRANSACTION_DAYS: parseInt(process.env.MAX_TRANSACTION_DAYS) || 365,
    DEFAULT_TRANSACTION_DAYS: parseInt(process.env.DEFAULT_TRANSACTION_DAYS) || 30,
  },
  
  // Security
  SECURITY: {
    HELMET_ENABLED: process.env.HELMET_ENABLED !== 'false',
    COMPRESSION_ENABLED: process.env.COMPRESSION_ENABLED !== 'false',
    API_KEY_CACHE_TTL: parseInt(process.env.API_KEY_CACHE_TTL) || 5 * 60 * 1000, // 5 minutes
  },
  
  // Health Check
  HEALTH_CHECK: {
    INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    TIMEOUT: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000, // 5 seconds
  },
  
  // Error Messages (Spanish)
  ERRORS: {
    AUTHENTICATION_FAILED: 'Autenticación fallida. Verificá tu API key.',
    INSUFFICIENT_PERMISSIONS: 'No tenés permisos para realizar esta acción.',
    SHEET_NOT_FOUND: 'Hoja no encontrada o sin acceso.',
    INVALID_PARAMETERS: 'Parámetros inválidos en la petición.',
    SERVER_ERROR: 'Error interno del servidor. Intentá nuevamente.',
    RATE_LIMIT_EXCEEDED: 'Límite de peticiones excedido. Esperá un momento.',
    AGENT_API_UNAVAILABLE: 'Servicio temporalmente no disponible. Intentá más tarde.',
  },
  
  // Success Messages (Spanish)
  SUCCESS: {
    EXPENSE_CREATED: 'Gasto creado exitosamente.',
    DATA_RETRIEVED: 'Datos obtenidos exitosamente.',
    TOOL_EXECUTED: 'Herramienta ejecutada exitosamente.',
  }
};

// Validation
if (!CONFIG.AGENT_API_URL) {
  throw new Error('AGENT_API_URL is required. Set it in environment variables or .env file.');
}

// Environment info logging
console.log(`🚀 MCP Server Configuration:`);
console.log(`   Environment: ${CONFIG.NODE_ENV}`);
console.log(`   Port: ${CONFIG.PORT}`);
console.log(`   Agent API: ${CONFIG.AGENT_API_URL}`);
console.log(`   CORS Origins: ${CONFIG.CORS_ORIGINS}`);

export default CONFIG;