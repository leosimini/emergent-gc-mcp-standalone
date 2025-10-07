# 🚀 Guía de Deployment - MCP Server Standalone

## 📋 **Resumen de la Solución**

Hemos creado un proyecto MCP Server **completamente independiente** que se puede deployar por separado del proyecto principal. Esto soluciona los problemas arquitecturales identificados:

✅ **Puerto independiente**: Se deploya en puerto estándar (80/443)  
✅ **Subdominio propio**: `mcp.tudominio.com`  
✅ **Conexión configurable**: Puede conectarse a dev/staging/prod del Agent API  
✅ **Transferencia de API key**: Valida API keys contra el backend principal  

## 🏗️ **Arquitectura Final**

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Claude Desktop    │    │  MCP Server         │    │  Gastos Compartidos │
│   Cursor IDE        │───▶│  mcp.tudominio.com  │───▶│  tudominio.com      │
│   Custom LLM        │    │  (Proyecto Standalone) │  │  /api/agent/v1/*    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                     │
                                     ▼
                           ┌─────────────────────┐
                           │  API Key Validation │
                           │  User Context Pass  │
                           │  Request Proxying   │
                           └─────────────────────┘
```

## 📦 **Código Preparado para Copiar**

Todo el código está listo en: `/app/mcp-server-standalone/`

### **Estructura del Proyecto Standalone:**
```
mcp-server-standalone/
├── package.json              # Dependencias y scripts
├── .env.example              # Configuración de ejemplo
├── vercel.json               # Config para Vercel
├── Dockerfile                # Config para Docker
├── README.md                 # Documentación completa
├── DEPLOYMENT_GUIDE.md       # Esta guía
├── src/
│   ├── server.js             # Servidor principal
│   ├── config/
│   │   └── environment.js    # Configuración por entorno
│   ├── auth/
│   │   └── api-key-auth.js   # Validación de API keys
│   ├── utils/
│   │   └── logger.js         # Sistema de logging
│   └── tools/
│       ├── base-tool.js      # Clase base para tools
│       ├── list-my-sheets.js # Herramienta listar hojas
│       └── get-sheet-summary.js # Herramienta resumen
└── logs/                     # Directorio de logs
```

## 🔧 **Configuración de Conexión con Agent API**

### **Variables de Entorno Críticas:**

```bash
# Para conectar a DESARROLLO
AGENT_API_URL=https://expense-wizard-103.preview.emergentagent.com

# Para conectar a PRODUCCIÓN  
AGENT_API_URL=https://gastoscompartidos.ai

# El MCP server automáticamente usa:
# - /api/mcp/validate-key para validar API keys
# - /api/agent/v1/* para herramientas
```

### **Transferencia de API Key:**

1. **Usuario obtiene API key** del perfil en la app principal
2. **LLM cliente usa API key** en requests al MCP server
3. **MCP server valida API key** contra el backend principal
4. **MCP server obtiene contexto** del usuario (ID, permisos, etc.)
5. **MCP server ejecuta herramientas** con contexto del usuario

## 🚀 **Pasos para Deployment**

### **Paso 1: Copiar Código**
```bash
# En tu máquina local
cp -r /app/mcp-server-standalone /ruta/local/gastoscompartidos-mcp-server
cd /ruta/local/gastoscompartidos-mcp-server

# Crear nuevo repositorio Git
git init
git add .
git commit -m "Initial MCP Server standalone"
git remote add origin https://github.com/tu-usuario/gastoscompartidos-mcp-server.git
git push -u origin main
```

### **Paso 2: Configurar Environment**
```bash
cp .env.example .env

# Editar .env con tus valores:
NODE_ENV=production
AGENT_API_URL=https://gastoscompartidos.ai  # Tu dominio principal
PORT=8080
```

### **Paso 3: Deploy en Vercel (Recomendado)**
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variables de entorno en Vercel Dashboard:
# NODE_ENV: production
# AGENT_API_URL: https://gastoscompartidos.ai
```

### **Paso 4: Configurar Subdominio**
```bash
# En tu DNS provider (Cloudflare, etc.)
# Agregar CNAME record:
mcp.gastoscompartidos.ai → tu-proyecto.vercel.app
```

## 🧪 **Testing del Deployment**

### **1. Health Check**
```bash
curl https://mcp.gastoscompartidos.ai/health
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "service": "gastoscompartidos-mcp-server",
  "environment": "production",
  "backend": {
    "agent_api_url": "https://gastoscompartidos.ai",
    "connectivity": "ok"
  }
}
```

### **2. Schema Discovery**
```bash
curl https://mcp.gastoscompartidos.ai/mcp/schema
```

### **3. API Key Validation**
```bash
# Usar API key real del perfil de usuario
curl -H "Authorization: Bearer gcp_real_api_key" \
     https://mcp.gastoscompartidos.ai/mcp/tools
```

### **4. Tool Execution**
```bash
curl -X POST \
     -H "Authorization: Bearer gcp_real_api_key" \
     -H "Content-Type: application/json" \
     -d '{"arguments": {"filter": "all"}}' \
     https://mcp.gastoscompartidos.ai/mcp/tools/list_my_sheets
```

## 🔗 **Configuración Final para LLM**

### **URL para conectar tu LLM:**
```
https://mcp.gastoscompartidos.ai
```

### **API Key:**
- Obtenida del perfil del usuario en `https://gastoscompartidos.ai/app/profile`
- Formato: `gcp_xxxxxxxxxxxx`

### **Endpoints disponibles:**
- `GET /health` - Health check
- `GET /mcp/schema` - Auto-discovery
- `GET /mcp/tools` - Listar herramientas
- `POST /mcp/tools/{name}` - Ejecutar herramienta

## 📊 **Monitoring & Maintenance**

### **Logs de Vercel:**
```bash
vercel logs --follow
```

### **Health Monitoring:**
- Health endpoint incluye test de conectividad con backend
- Logs estructurados con información de environment
- Cache statistics de API keys

### **Performance:**
- Rate limiting: 100 req/min por IP
- API key caching: 5 minutos TTL
- Request timeout: 30 segundos
- Log rotation automática

## 🔒 **Consideraciones de Seguridad**

1. **API Key Security**: Se validan contra backend principal
2. **Environment Isolation**: Variables separadas dev/prod
3. **CORS Configuration**: Orígenes específicos en prod
4. **Rate Limiting**: Por IP y por API key
5. **Audit Logging**: Todos los requests loggeados

## ✅ **Checklist Final**

- [ ] Código copiado a nuevo repositorio
- [ ] Variables de entorno configuradas
- [ ] Deployment realizado (Vercel/Railway/Custom)
- [ ] Subdominio configurado
- [ ] Health check funcionando
- [ ] API key validation funcionando
- [ ] Tool execution funcionando
- [ ] LLM client configurado
- [ ] Monitoring configurado

## 📞 **URLs Finales**

- **MCP Server**: `https://mcp.gastoscompartidos.ai`
- **Health Check**: `https://mcp.gastoscompartidos.ai/health`
- **Schema**: `https://mcp.gastoscompartidos.ai/mcp/schema`
- **Backend**: `https://gastoscompartidos.ai` (configurado en AGENT_API_URL)

---

## 🎯 **Conclusión**

Con esta configuración:
1. ✅ **MCP Server independiente** deployado en subdominio
2. ✅ **Puerto estándar** (80/443) accesible por LLMs
3. ✅ **Conexión configurable** a diferentes entornos del Agent API
4. ✅ **API Key transferencia** automática y segura
5. ✅ **Escalabilidad** independiente del proyecto principal

Tu LLM podrá conectarse a `https://mcp.gastoscompartidos.ai` usando la API key del usuario y acceder a todas las funcionalidades de gastos compartidos de manera segura.