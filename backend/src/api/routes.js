const express = require('express');
const { handleChat } = require('./chat.controller');
const { getTenantInfo } = require('./tenant.controller');

const router = express.Router();

/**
 * Chat endpoint
 * POST /chat
 * 
 * Handles chat requests for multi-tenant SAAI platform
 * Currently echoes back the message and tenant
 * Will be extended with tenant loader, orchestrator, memory, and adapters
 */
router.post('/chat', handleChat);

/**
 * Tenant information endpoint
 * GET /tenant/:tenantId
 * 
 * Returns tenant-specific configuration, action registry, and theme settings
 * Used by the frontend to customize UI for each tenant
 * 
 * Loads configuration from JSON files in src/config/tenants/
 * Loads action registry from JSON files in src/registry/
 */
router.get('/tenant/:tenantId', getTenantInfo);

module.exports = router;
