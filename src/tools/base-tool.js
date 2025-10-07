/**
 * Base Tool Class for MCP Server
 */

import axios from 'axios';
import { CONFIG } from '../config/environment.js';
import { logger, logToolUsage, logError } from '../utils/logger.js';

export class BaseTool {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  /**
   * Make authenticated request to Agent API
   */
  async makeAgentAPIRequest(endpoint, method = 'GET', data = null, user, keyId) {
    const startTime = Date.now();
    
    try {
      // Create JWT token for user (simulate internal auth)
      // In production, you might want to use a service account or internal auth
      const authToken = await this.createUserToken(user);
      
      const config = {
        method,
        url: `${CONFIG.AGENT_API_URL}${CONFIG.AGENT_API_PREFIX}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'GastosCompartidos-MCP-Server/1.0',
          'X-MCP-Key-ID': keyId
        },
        timeout: 10000
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      
      logToolUsage(this.name, user.id, keyId, data || {}, true, responseTime);
      
      return response.data;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logToolUsage(this.name, user.id, keyId, data || {}, false, responseTime);
      
      if (error.response) {
        // HTTP error response
        logger.warn('Agent API request failed', {
          tool: this.name,
          userId: user.id,
          keyId,
          status: error.response.status,
          endpoint,
          error: error.response.data
        });
        
        throw new ToolError(
          this.getErrorMessage(error.response.status, error.response.data),
          error.response.status,
          error.response.data
        );
      } else {
        // Network or other error
        logError(error, {
          tool: this.name,
          userId: user.id,
          keyId,
          endpoint
        });
        
        throw new ToolError(
          CONFIG.ERRORS.SERVER_ERROR,
          500,
          { error_code: 'NETWORK_ERROR' }
        );
      }
    }
  }

  /**
   * Create a user token for internal API requests
   * This is a simplified approach - in production you'd use proper service accounts
   */
  async createUserToken(user) {
    try {
      // For now, we'll make requests using a special MCP service token
      // This should be replaced with proper service account authentication
      return `mcp_service_token_${user.id}`;
    } catch (error) {
      throw new ToolError('Authentication error', 500);
    }
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(status, errorData) {
    switch (status) {
      case 401:
        return CONFIG.ERRORS.AUTHENTICATION_FAILED;
      case 403:
        return CONFIG.ERRORS.INSUFFICIENT_PERMISSIONS;
      case 404:
        return CONFIG.ERRORS.SHEET_NOT_FOUND;
      case 429:
        return CONFIG.ERRORS.RATE_LIMIT_EXCEEDED;
      case 400:
        return errorData?.message_for_user || CONFIG.ERRORS.INVALID_PARAMETERS;
      default:
        return CONFIG.ERRORS.SERVER_ERROR;
    }
  }

  /**
   * Validate required parameters
   */
  validateParams(params, requiredFields) {
    const missing = requiredFields.filter(field => !params[field]);
    
    if (missing.length > 0) {
      throw new ToolError(
        `Parámetros requeridos faltantes: ${missing.join(', ')}`,
        400
      );
    }
  }

  /**
   * Execute the tool - to be implemented by subclasses
   */
  async execute(params, user, keyId) {
    throw new Error('execute() method must be implemented by subclass');
  }

  /**
   * Get tool schema for MCP protocol
   */
  getSchema() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.getInputSchema()
    };
  }

  /**
   * Get input schema - to be implemented by subclasses
   */
  getInputSchema() {
    return {
      type: 'object',
      properties: {},
      required: []
    };
  }
}

/**
 * Custom error class for tools
 */
export class ToolError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'ToolError';
    this.statusCode = statusCode;
    this.details = details;
  }
}