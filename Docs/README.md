# SAAI Platform

**S**mart **A**I **A**gent **I**nterface Platform - A production-ready, multi-tenant AI chat platform with extensible action framework.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0.4-black)](https://nextjs.org/)

## 🌟 Features

### Multi-Tenant Architecture
- **Tenant Isolation**: Complete separation of tenant configurations, branding, and data
- **Dynamic Theming**: Per-tenant color schemes, logos, and branding
- **Subdomain Support**: Automatic tenant detection from `client1.saai.pro` → `client1`
- **Configurable Actions**: Tenant-specific action registries with enable/disable controls

### Production-Ready Backend
- **Security Hardening**: Helmet headers, CORS validation, rate limiting
- **Structured Logging**: JSON logging for easy parsing and monitoring
- **Error Handling**: Centralized error handling with appropriate HTTP status codes
- **LLM Integration**: Multi-provider support (Groq, Gemini, Mistral) with fallback
- **Action Framework**: Extensible orchestrator with adapter pattern

### Modern Frontend
- **Next.js 16**: Latest React with App Router and Server Components
- **TypeScript**: Full type safety across the codebase
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Real-time Chat**: Streaming responses with loading indicators
- **SSR Support**: Server-side rendering with tenant detection

## 📁 Project Structure

```
saai-platform/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── api/               # API routes and controllers
│   │   │   ├── routes.js
│   │   │   ├── chat.controller.js
│   │   │   └── tenant.controller.js
│   │   ├── config/            # Tenant configurations
│   │   │   └── tenants/
│   │   │       └── *.json
│   │   ├── registry/          # Action registries
│   │   │   └── *.registry.json
│   │   ├── orchestrator/      # Action orchestration
│   │   │   ├── index.js
│   │   │   └── tools.js
│   │   ├── adapters/          # Generic action adapters
│   │   │   └── *Adapter.js
│   │   ├── tenants/           # Tenant-specific adapters
│   │   │   └── *.adapter.js
│   │   ├── middleware/        # Express middleware
│   │   │   └── errorHandler.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── tenantLoader.js
│   │   │   ├── registryLoader.js
│   │   │   └── logger.js
│   │   └── llm/               # LLM provider integrations
│   │       ├── providers/
│   │       └── llmRouter.js
│   ├── server.js              # Express server entry point
│   ├── package.json
│   └── .env.example
├── frontend/                   # Next.js UI (shared-ui)
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # Main chat page
│   │   └── layout.tsx
│   ├── components/            # React components
│   │   ├── ChatLayout.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ChatInput.tsx
│   ├── config/                # Frontend configuration
│   │   └── tenant.ts
│   ├── utils/                 # Utility functions
│   │   └── tenant.ts
│   ├── public/                # Static assets
│   ├── package.json
│   └── next.config.js
├── Docs/                      # Documentation
│   ├── STEP_*_COMPLETE.md    # Implementation guides
│   ├── STEP_*_TESTING_GUIDE.md
│   └── STEP_*_SUMMARY.md
├── .gitignore
├── README.md                  # This file
├── LICENSE                    # MIT License
├── GIT_SETUP.md              # Git setup instructions
└── DEPLOYMENT.md             # Deployment guide

```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 (or yarn/pnpm)
- **Git**: Latest version
- **LLM API Keys**: At least one of:
  - Groq API key (recommended for speed)
  - Google Gemini API key
  - Mistral API key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` file:**
   ```bash
   PORT=3001
   NODE_ENV=development
   
   # LLM Provider Priority (comma-separated)
   LLM_PRIORITY=GROQ,GEMINI,MISTRAL,MOCK
   
   # API Keys (add your own)
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   MISTRAL_API_KEY=your_mistral_api_key_here
   ```

5. **Start the backend server:**
   ```bash
   npm start
   ```

   The backend will be available at `http://localhost:3001`

6. **Verify it's running:**
   ```bash
   curl http://localhost:3001/
   # Expected: {"status":"ok","service":"SAAI backend"}
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   # Create .env.local file
   echo "NEXT_PUBLIC_SAAI_API=http://localhost:3001" > .env.local
   echo "NEXT_PUBLIC_DEFAULT_TENANT=example" >> .env.local
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000` (or `http://localhost:3002` if 3000 is in use)

5. **Open in browser:**
   - Navigate to `http://localhost:3000` (or the port shown in terminal)
   - You should see the SAAI chat interface
   - Default tenant is "example" with blue theme

## 🏗️ Architecture

### Backend Architecture

```
Request Flow:
  Client Request
    ↓
  Helmet (Security Headers)
    ↓
  Morgan (HTTP Logging)
    ↓
  Rate Limiter (DDoS Protection)
    ↓
  CORS Validator
    ↓
  Routes (chat, tenant)
    ↓
  Controllers
    ↓
  Orchestrator (Action Routing)
    ↓
  Adapters (Tool Execution)
    ↓
  LLM Router (AI Processing)
    ↓
  Error Handler
    ↓
  Response
```

### Frontend Architecture

```
Page Load:
  1. Detect tenant from hostname (client1.saai.pro → "client1")
  2. Load tenant theme from backend API
  3. Apply theme colors and branding
  4. Render chat interface

Chat Flow:
  1. User sends message
  2. POST /chat with tenantId, message, sessionId
  3. Backend processes with LLM
  4. Backend executes actions if needed
  5. Response streamed back to frontend
  6. Display in chat with theme styling
```

## 🔧 Configuration

### Adding a New Tenant

1. **Create tenant configuration file:**
   ```bash
   # backend/src/config/tenants/acme.json
   {
     "tenantId": "acme",
     "displayName": "Acme Corp",
     "brandColor": "#FF6B35",
     "logoUrl": "/logos/acme-logo.png",
     "apiGateway": "https://acme.com/api",
     "features": {
       "recommendation": true,
       "cart": true,
       "checkout": true
     }
   }
   ```

2. **Create action registry (optional):**
   ```bash
   # backend/src/registry/acme.registry.json
   {
     "tenantId": "acme",
     "actions": {
       "search_products": {
         "enabled": true,
         "description": "Search ACME products",
         "handler": "commerce.search"
       }
     }
   }
   ```

3. **Restart backend server:**
   ```bash
   # The new tenant will be automatically available
   curl http://localhost:3001/tenant/acme
   ```

### Environment Variables

#### Backend (.env)
```bash
# Server
PORT=3001
NODE_ENV=development  # or 'production'

# LLM Configuration
LLM_PRIORITY=GROQ,GEMINI,MISTRAL,MOCK
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here

# Logging (production only)
ENABLE_TOOL_LOGS=false
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_SAAI_API=http://localhost:3001
NEXT_PUBLIC_DEFAULT_TENANT=example
```

## 📚 API Documentation

### Endpoints

#### `GET /`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "SAAI backend"
}
```

#### `GET /tenant/:tenantId`
Get tenant configuration, action registry, and theme.

**Parameters:**
- `tenantId` (path): Tenant identifier

**Response (200):**
```json
{
  "success": true,
  "tenantId": "example",
  "tenantConfig": { ... },
  "actionRegistry": { ... },
  "theme": {
    "headerTitle": "Example Tenant",
    "primaryColor": "#4A90E2",
    "secondaryColor": "#FFFFFF",
    "logoUrl": "/default-logo.png"
  }
}
```

**Error Responses:**
- `404`: Tenant not found
- `400`: Missing tenant ID
- `500`: Server error

#### `POST /chat`
Send a chat message and get AI response.

**Request Body:**
```json
{
  "tenantId": "example",
  "message": "Find me a laptop under $1000",
  "sessionId": "unique-session-id"
}
```

**Response (200):**
```json
{
  "success": true,
  "response": "I found 5 laptops under $1000...",
  "sessionId": "unique-session-id",
  "actions": [
    {
      "action": "search_products",
      "params": { "query": "laptop", "maxPrice": 1000 },
      "result": { ... }
    }
  ]
}
```

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests (when implemented)
npm test

# Manual testing
npm start

# Test health check
curl http://localhost:3001/

# Test tenant endpoint
curl http://localhost:3001/tenant/example | jq .

# Test chat endpoint
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "example",
    "message": "Hello",
    "sessionId": "test-123"
  }' | jq .
```

### Frontend Tests

```bash
cd frontend

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📦 Deployment

### Backend Deployment

**Recommended:** Railway, Render, or AWS EC2

1. Set environment variables on hosting platform
2. Set `NODE_ENV=production`
3. Run: `npm start`
4. Ensure port is configured (Railway auto-assigns)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Frontend Deployment (Vercel)

1. **Push code to GitHub** (see [GIT_SETUP.md](./GIT_SETUP.md))

2. **Import to Vercel:**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`

3. **Configure Environment Variables:**
   ```
   NEXT_PUBLIC_SAAI_API=https://your-backend-url.com
   NEXT_PUBLIC_DEFAULT_TENANT=example
   ```

4. **Deploy:**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Get your deployment URL: `https://your-app.vercel.app`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Vercel setup.

## 🔒 Security

### Implemented Security Features

- ✅ **Helmet Headers**: CSP, HSTS, X-Frame-Options, etc.
- ✅ **CORS Validation**: Whitelist-based origin checking
- ✅ **Rate Limiting**: 60-100 requests/min per IP
- ✅ **Input Sanitization**: Tenant ID and namespace validation
- ✅ **Error Sanitization**: Generic errors in production
- ✅ **Environment Secrets**: API keys in .env (not committed)

### Security Best Practices

- Never commit `.env` files
- Rotate API keys regularly
- Use HTTPS in production
- Review `allowedOrigins` in `server.js` for production
- Enable rate limiting stricter in production
- Set up monitoring for suspicious activity

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Workflow

1. Ensure backend and frontend run locally
2. Test your changes thoroughly
3. Update documentation if needed
4. Follow existing code style
5. Add comments for complex logic

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- UI styling with [Tailwind CSS](https://tailwindcss.com/)
- LLM integrations: [Groq](https://groq.com/), [Google Gemini](https://deepmind.google/technologies/gemini/), [Mistral AI](https://mistral.ai/)

## 📞 Support

For issues, questions, or suggestions:

- Open an issue on GitHub
- Review existing documentation in `/Docs`
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help

## 🗺️ Roadmap

### Completed (Steps 1-9)
- ✅ Multi-tenant backend with configuration system
- ✅ Action registry and orchestrator
- ✅ LLM integration with multiple providers
- ✅ Next.js UI with dynamic theming
- ✅ Tenant detection and theme loading
- ✅ Security hardening and production setup

### Planned
- [ ] Authentication & authorization (JWT)
- [ ] WebSocket support for real-time chat
- [ ] User session persistence (Redis)
- [ ] Analytics and metrics dashboard
- [ ] Admin panel for tenant management
- [ ] API versioning (v1, v2)
- [ ] Internationalization (i18n)
- [ ] Mobile app (React Native)

---

**Built with ❤️ for multi-tenant AI applications**
