# 🔗 Conexión MCP Server ↔ Agent API

## 📋 **Cómo Funciona la Integración**

### **Flujo de Autenticación y Datos:**

```
1. Usuario obtiene API key → https://gastoscompartidos.ai/app/profile
                            (sección "Integraciones Avanzadas")

2. LLM Client → MCP Server → "Authorization: Bearer gcp_xxxxx"
   
3. MCP Server → Backend → POST /api/mcp/validate-key
                         { "api_key": "gcp_xxxxx" }

4. Backend valida → MCP Server recibe:
   {
     "valid": true,
     "user": { "id": "user123", "email": "user@example.com" },
     "key_id": "ak_xyz",
     "scopes": ["mcp:read", "mcp:write"]
   }

5. MCP Server → Backend → GET /api/agent/v1/sheets/{id}/state
                         (usando contexto del usuario)

6. MCP Server → LLM Client → Respuesta formateada
```

## ⚙️ **Configuración de Endpoints**

### **Variables de Environment:**

```javascript
// En src/config/environment.js

const AGENT_API_ENVIRONMENTS = {
  development: 'https://expense-wizard-103.preview.emergentagent.com',
  production: 'https://gastoscompartidos.ai'
};

// Endpoints usados por el MCP Server:
CONFIG = {
  AGENT_API_URL: getAgentApiUrl(),                    // Base URL
  AGENT_API_PREFIX: '/api/agent/v1',                  // Prefix para herramientas
  API_KEY_VALIDATION_ENDPOINT: '/api/mcp/validate-key' // Validación de API key
}
```

### **Ejemplo de Configuración por Entorno:**

#### **Development (.env):**
```bash
NODE_ENV=development
AGENT_API_URL=https://expense-wizard-103.preview.emergentagent.com
```

#### **Production (.env):**
```bash
NODE_ENV=production  
AGENT_API_URL=https://gastoscompartidos.ai
```

## 🔧 **Implementación de la Conexión**

### **1. Validación de API Key (auth/api-key-auth.js):**

```javascript
async validateAPIKey(apiKey) {
  // POST https://gastoscompartidos.ai/api/mcp/validate-key
  const response = await this.apiClient.post('/api/mcp/validate-key', {
    api_key: apiKey
  });
  
  return response.data; // { valid: true, user: {...}, scopes: [...] }
}
```

### **2. Ejecución de Herramientas (tools/base-tool.js):**

```javascript
async makeAgentAPIRequest(endpoint, method, data, user, keyId) {
  // Crear contexto de usuario para Agent API
  const authToken = await this.createUserToken(user);
  
  // GET https://gastoscompartidos.ai/api/agent/v1/sheets/123/state
  const response = await axios({
    method,
    url: `${CONFIG.AGENT_API_URL}${CONFIG.AGENT_API_PREFIX}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'X-MCP-Key-ID': keyId,
      'X-MCP-User-ID': user.id
    },
    data
  });
  
  return response.data;
}
```

## 🔑 **Sistema de Transferencia de API Key**

### **Paso a Paso del Flujo:**

1. **Usuario genera API key** en su perfil:
   ```
   https://gastoscompartidos.ai/app/profile
   → Sección "Integraciones Avanzadas"  
   → "Generar API Key"
   → Obtiene: gcp_Rjue_BuzgKusKvzHpcdNnJWsKuQgIvcTjSiXF0QrtaA
   ```

2. **Usuario configura LLM client:**
   ```json
   {
     "baseUrl": "https://mcp.gastoscompartidos.ai",
     "apiKey": "gcp_Rjue_BuzgKusKvzHpcdNnJWsKuQgIvcTjSiXF0QrtaA"
   }
   ```

3. **LLM hace request al MCP server:**
   ```http
   POST https://mcp.gastoscompartidos.ai/mcp/tools/list_my_sheets
   Authorization: Bearer gcp_Rjue_BuzgKusKvzHpcdNnJWsKuQgIvcTjSiXF0QrtaA
   ```

4. **MCP server valida API key:**
   ```javascript
   // MCP Server → Backend Principal
   POST https://gastoscompartidos.ai/api/mcp/validate-key
   {
     "api_key": "gcp_Rjue_BuzgKusKvzHpcdNnJWsKuQgIvcTjSiXF0QrtaA"
   }
   ```

5. **Backend responde con contexto del usuario:**
   ```javascript
   {
     "valid": true,
     "user": {
       "id": "user_123",
       "email": "usuario@example.com",
       "name": "Juan Pérez"
     },
     "key_id": "ak_xyz789",
     "scopes": ["mcp:read", "mcp:write"]
   }
   ```

6. **MCP server ejecuta herramientas con contexto:**
   ```javascript
   // MCP Server → Agent API con contexto de usuario
   GET https://gastoscompartidos.ai/api/agent/v1/sheets/{sheet_id}/state
   Headers: {
     "Authorization": "Bearer internal_service_token",
     "X-MCP-User-ID": "user_123",
     "X-MCP-Key-ID": "ak_xyz789"
   }
   ```

## 🛠️ **Configuración del Agent API Backend**

### **Endpoint de Validación (ya implementado):**

```python
# /app/backend/mcp_auth_endpoints.py

@mcp_auth_router.post("/validate-key")
async def validate_api_key(request: APIKeyValidationRequest):
    auth_data = await api_key_manager.validate_api_key(request.api_key)
    
    if auth_data:
        return {
            "valid": True,
            "user": auth_data["user"],
            "key_id": auth_data["key_id"],
            "scopes": auth_data["scopes"]
        }
    else:
        return {"valid": False, "reason": "Invalid key"}
```

### **Modificación del Agent API (pendiente):**

```python
# Agregar soporte para contexto MCP en agent_api.py

def get_mcp_user_context(request: Request):
    """Extract MCP user context from headers"""
    mcp_user_id = request.headers.get("X-MCP-User-ID")
    mcp_key_id = request.headers.get("X-MCP-Key-ID")
    
    if mcp_user_id:
        # Load user context for MCP request
        return {"id": mcp_user_id, "source": "mcp", "key_id": mcp_key_id}
    
    return None
```

## 🔄 **Testing de la Conexión**

### **1. Test de Conectividad Backend:**
```bash
# Desde MCP server
curl https://gastoscompartidos.ai/health
```

### **2. Test de Validación de API Key:**
```bash
curl -X POST \
  https://gastoscompartidos.ai/api/mcp/validate-key \
  -H "Content-Type: application/json" \
  -d '{"api_key": "gcp_tu_api_key"}'
```

### **3. Test de Agent API:**
```bash
curl -H "Authorization: Bearer token" \
     -H "X-MCP-User-ID: user_123" \
     https://gastoscompartidos.ai/api/agent/v1/sheets/123/state
```

### **4. Test End-to-End:**
```bash
curl -X POST \
  https://mcp.gastoscompartidos.ai/mcp/tools/list_my_sheets \
  -H "Authorization: Bearer gcp_tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"filter": "all"}}'
```

## 🚨 **Consideraciones de Seguridad**

### **Validación de API Keys:**
- ✅ API keys se validan contra la base de datos principal
- ✅ Cada key está asociada a un usuario específico
- ✅ Scopes/permisos se respetan
- ✅ Keys pueden ser revocadas instantáneamente

### **Transferencia Segura de Contexto:**
- ✅ Headers internos para identificar requests MCP
- ✅ No exposición de tokens internos
- ✅ Rate limiting por API key
- ✅ Logging completo de actividad

### **Aislamiento de Datos:**
- ✅ Usuario solo accede a sus propios datos
- ✅ Filtrado automático por user_id  
- ✅ Validación de permisos en cada request
- ✅ No cross-tenant data leakage

## ⚡ **Performance y Caching**

### **API Key Caching:**
```javascript
// Cache de 5 minutos para API keys válidas
this.cacheTimeout = 5 * 60 * 1000;

// Cleanup automático cada 10 minutos
setInterval(() => {
  apiKeyAuth.cleanupCache();
}, 10 * 60 * 1000);
```

### **Connection Pooling:**
```javascript
// Axios instance con configuración optimizada
this.apiClient = axios.create({
  baseURL: CONFIG.AGENT_API_URL,
  timeout: 10000,
  maxRedirects: 5,
  keepAlive: true
});
```

## 📊 **Monitoring de la Conexión**

### **Health Check Completo:**
```javascript
// GET /health incluye test de backend connectivity
{
  "status": "healthy",
  "backend": {
    "agent_api_url": "https://gastoscompartidos.ai",
    "connectivity": "ok",
    "response_time_ms": 45
  }
}
```

### **Logs Estructurados:**
```javascript
// Logs incluyen información de conexión
logger.info('API key validated', {
  userId: authData.user.id,
  keyId: authData.keyId,
  agentApiUrl: CONFIG.AGENT_API_URL,
  environment: CONFIG.NODE_ENV
});
```

---

## ✅ **Checklist de Configuración**

- [ ] Variable `AGENT_API_URL` configurada correctamente
- [ ] Endpoint `/api/mcp/validate-key` funcionando
- [ ] Agent API accesible desde MCP server  
- [ ] API keys generándose correctamente en perfil
- [ ] Validación de API key funcionando
- [ ] Contexto de usuario transfiriéndose
- [ ] Herramientas ejecutándose con datos del usuario
- [ ] Logs mostrando requests exitosos
- [ ] Health check reportando backend connectivity
- [ ] Rate limiting funcionando correctamente

Con esta configuración, tu MCP server puede conectarse dinámicamente a diferentes entornos del Agent API y transferir el contexto del usuario de manera segura.