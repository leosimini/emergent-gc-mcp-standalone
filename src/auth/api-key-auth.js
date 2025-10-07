/**
 * API Key Authentication for Standalone MCP Server
 * Validates API keys against the main Gastos Compartidos backend
 */

import axios from 'axios';
import { CONFIG } from '../config/environment.js';
import { logger } from '../utils/logger.js';

class APIKeyAuth {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = CONFIG.SECURITY.API_KEY_CACHE_TTL;
    
    // Create axios instance with configured timeout and base URL
    this.apiClient = axios.create({
      baseURL: CONFIG.AGENT_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GastosCompartidos-MCP-Server/1.0'
      }
    });
    
    logger.info('API Key Auth initialized', {
      agentApiUrl: CONFIG.AGENT_API_URL,
      cacheTimeout: this.cacheTimeout
    });
  }

  /**
   * Validate API key against main backend
   */
  async validateAPIKey(apiKey) {
    try {
      // Check cache first
      const cached = this.cache.get(apiKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.debug('API key cache hit', { keyPrefix: this.getKeyPrefix(apiKey) });
        return cached;
      }

      // Validate against main backend
      logger.debug('Validating API key with backend', {
        endpoint: CONFIG.API_KEY_VALIDATION_ENDPOINT,
        keyPrefix: this.getKeyPrefix(apiKey)
      });

      const response = await this.apiClient.post(CONFIG.API_KEY_VALIDATION_ENDPOINT, {
        api_key: apiKey
      });

      if (response.data.valid) {
        const authData = {
          user: response.data.user,
          keyId: response.data.key_id,
          scopes: response.data.scopes,
          rateLimitTier: response.data.rate_limit_tier,
          timestamp: Date.now()
        };

        // Cache the result
        this.cache.set(apiKey, authData);

        logger.info('API key validated successfully', {
          userId: authData.user.id,
          keyId: authData.keyId,
          scopes: authData.scopes
        });

        return authData;
      } else {
        logger.warn('API key validation failed', {
          keyPrefix: this.getKeyPrefix(apiKey),
          reason: response.data.reason
        });
        return null;
      }

    } catch (error) {
      if (error.response?.status === 401) {
        logger.warn('Invalid API key rejected by backend', {
          keyPrefix: this.getKeyPrefix(apiKey)
        });
        return null;
      }
      
      // Log backend connection errors
      logger.error('API key validation error', {
        error: error.message,
        status: error.response?.status,
        agentApiUrl: CONFIG.AGENT_API_URL,
        keyPrefix: this.getKeyPrefix(apiKey)
      });
      
      // Don't cache errors, allow retry
      throw new Error('Backend validation service unavailable');
    }
  }

  /**
   * Extract API key from request headers
   */
  extractAPIKey(headers) {
    // Try different header formats
    const authHeader = headers.authorization || headers.Authorization;
    
    if (authHeader) {
      // Bearer token format
      if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
      }
      
      // Direct token
      if (authHeader.startsWith('gcp_')) {
        return authHeader;
      }
    }

    // Try X-API-Key header
    const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'];
    if (apiKeyHeader) {
      return apiKeyHeader;
    }

    return null;
  }

  /**
   * Check if user has required scope
   */
  hasScope(userScopes, requiredScope) {
    if (!userScopes || !Array.isArray(userScopes)) {
      return false;
    }
    
    return userScopes.includes(requiredScope) || userScopes.includes('mcp:admin');
  }

  /**
   * Get safe key prefix for logging
   */
  getKeyPrefix(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return 'invalid_key';
    }
    return apiKey.substring(0, 8) + '***';
  }

  /**
   * Clear cached API key
   */
  clearCache(apiKey) {
    this.cache.delete(apiKey);
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.cache.entries()) {
      if (now - data.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cleaned expired cache entries', { count: cleaned });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      timeout: this.cacheTimeout,
      backend_url: CONFIG.AGENT_API_URL
    };
  }

  /**
   * Test backend connectivity
   */
  async testBackendConnectivity() {
    try {
      const response = await this.apiClient.get('/health', { timeout: 5000 });
      return {
        success: true,
        status: response.status,
        backend_url: CONFIG.AGENT_API_URL
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        backend_url: CONFIG.AGENT_API_URL
      };
    }
  }
}

// Global instance
export const apiKeyAuth = new APIKeyAuth();

// Cleanup cache every 10 minutes
setInterval(() => {
  apiKeyAuth.cleanupCache();
}, 10 * 60 * 1000);

export default apiKeyAuth;