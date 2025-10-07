# 🚀 Gastos Compartidos MCP Server - Standalone

Servidor MCP (Model Context Protocol) independiente para integrar Gastos Compartidos con agentes LLM externos como Claude Desktop, Cursor IDE, y asistentes personalizados.

## 🏗️ Arquitectura

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   LLM Client        │    │  MCP Server         │    │  Gastos Compartidos │
│  (Claude Desktop)   │───▶│  mcp.tudominio.com  │───▶│  tudominio.com      │
│                     │    │  (Este Proyecto)    │    │  /api/agent/v1/*    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## ⚙️ Configuración de Entornos

### Variables de Entorno Requeridas

Copia `.env.example` a `.env` y configura:

```bash
# Environment (development/staging/production)
NODE_ENV=production
PORT=8080

# CRITICAL: URL del backend de Gastos Compartidos
AGENT_API_URL=https://gastoscompartidos.ai
# Para desarrollo: https://expense-wizard-103.preview.emergentagent.com

# Security y Performance
CORS_ORIGINS=*
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### 🎯 Configuración por Entorno

#### Development
```bash
NODE_ENV=development
AGENT_API_URL=https://expense-wizard-103.preview.emergentagent.com
LOG_LEVEL=debug
```

#### Production
```bash
NODE_ENV=production
AGENT_API_URL=https://gastoscompartidos.ai
LOG_LEVEL=info
HELMET_ENABLED=true
```

## 🚀 Deployment Options

### Option 1: Vercel (Recomendado)

1. **Preparar el proyecto:**
   ```bash
   npm install -g vercel
   cd gastoscompartidos-mcp-server
   ```

2. **Configurar variables de entorno en Vercel:**
   ```bash
   vercel env add NODE_ENV production
   vercel env add AGENT_API_URL https://gastoscompartidos.ai
   vercel env add PORT 8080
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Tu MCP server estará disponible en:**
   ```
   https://tu-proyecto.vercel.app
   ```

### Option 2: Railway

1. **Conectar con Railway:**
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Configurar variables:**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set AGENT_API_URL=https://gastoscompartidos.ai
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

### Option 3: Render

1. **Conectar repositorio en Render Dashboard**
2. **Configurar variables de entorno:**
   - `NODE_ENV`: `production`
   - `AGENT_API_URL`: `https://gastoscompartidos.ai`
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`

### Option 4: Custom Domain/VPS

```bash
# En tu servidor
git clone tu-repositorio
cd gastoscompartidos-mcp-server
npm install
cp .env.example .env
# Configurar .env con tus valores

# Con PM2
npm install -g pm2
pm2 start src/server.js --name mcp-server
pm2 startup
pm2 save

# Con systemd
sudo cp deployment/mcp-server.service /etc/systemd/system/
sudo systemctl enable mcp-server
sudo systemctl start mcp-server
```

## 🔧 Configuración de Subdominio

### Con Cloudflare/DNS Provider

1. **Agregar registro A/CNAME:**
   ```
   mcp.tudominio.com → IP de tu servidor
   ```

2. **Configurar proxy/SSL en Cloudflare:**
   - SSL: Full (strict)
   - Proxy: Enabled

3. **Tu MCP server será accesible en:**
   ```
   https://mcp.tudominio.com
   ```

## 📡 Endpoints Disponibles

### Health Check (sin auth)
```http
GET https://mcp.tudominio.com/health
```

### Schema Discovery (sin auth)
```http
GET https://mcp.tudominio.com/mcp/schema
```

### List Tools (requiere API key)
```http
GET https://mcp.tudominio.com/mcp/tools
Authorization: Bearer gcp_your_api_key
```

### Execute Tool (requiere API key)
```http
POST https://mcp.tudominio.com/mcp/tools/list_my_sheets
Authorization: Bearer gcp_your_api_key
Content-Type: application/json

{
  "arguments": {
    "filter": "all",
    "limit": 20
  }
}
```

## 🔑 Integración con LLM Clients

### Claude Desktop
```json
{
  "mcpServers": {
    "gastos-compartidos": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "https://mcp.tudominio.com/mcp/tools/{tool}",
        "-H", "Authorization: Bearer gcp_your_api_key",
        "-H", "Content-Type: application/json"
      ]
    }
  }
}
```

### Custom JavaScript Client
```javascript
const client = new GastosCompartidosClient({
  baseUrl: 'https://mcp.tudominio.com',
  apiKey: 'gcp_your_api_key'
});

const sheets = await client.listMySheets();
```

## 🧪 Testing del Deployment

### 1. Health Check
```bash
curl https://mcp.tudominio.com/health
```

### 2. Schema Discovery
```bash
curl https://mcp.tudominio.com/mcp/schema
```

### 3. Authenticated Request
```bash
curl -H "Authorization: Bearer gcp_your_api_key" \
     https://mcp.tudominio.com/mcp/tools
```

### 4. Tool Execution
```bash
curl -X POST \
     -H "Authorization: Bearer gcp_your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"arguments": {"filter": "all"}}' \
     https://mcp.tudominio.com/mcp/tools/list_my_sheets
```

## 📊 Monitoring y Logs

### Vercel Logs
```bash
vercel logs
```

### Railway Logs
```bash
railway logs
```

### Local/VPS Logs
```bash
# PM2 logs
pm2 logs mcp-server

# Direct logs
tail -f logs/mcp-server.log
```

### Health Monitoring
- Health endpoint: `/health`
- Includes backend connectivity test
- Cache statistics
- Environment information

## 🔒 Security Considerations

1. **API Key Security**: Las API keys se validan contra el backend principal
2. **Rate Limiting**: 100 requests/minuto por IP
3. **CORS**: Configurado para permitir orígenes específicos
4. **Helmet**: Headers de seguridad en producción
5. **Logs**: Auditoría completa de requests y errores

## 🚨 Troubleshooting

### Error: Backend connection failed
```bash
# Verificar conectividad
curl https://mcp.tudominio.com/health
# Revisar AGENT_API_URL en variables de entorno
```

### Error: 401 Unauthorized
```bash
# Verificar API key en perfil de usuario
# Probar con nueva API key
```

### Error: Rate limit exceeded
```bash
# Esperar 1 minuto
# Implementar retry logic en cliente
```

## 📚 Development

```bash
# Setup local
git clone tu-repositorio
cd gastoscompartidos-mcp-server
npm install
cp .env.example .env
# Configurar AGENT_API_URL para development

# Run development
npm run dev

# Run tests
npm test

# Check logs
tail -f logs/mcp-server.log
```

## 🤝 Contributing

1. Fork el repositorio
2. Crear feature branch
3. Implementar cambios
4. Testear con `npm test`
5. Crear Pull Request

---

## 📞 Support

- **Health Check**: `GET /health` para status del servidor
- **Documentation**: `GET /mcp/schema` para API reference
- **Logs**: Revisar logs del deployment para troubleshooting