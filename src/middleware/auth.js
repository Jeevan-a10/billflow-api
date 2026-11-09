const DEFAULT_API_KEY = process.env.API_KEY || 'bf_live_test_api_key_secret_2026';

const requireApiKey = (req, res, next) => {
  // Allow bypassing auth in test mode when explicit header or env is set, or if public endpoint
  if (req.path.startsWith('/health') || req.path.startsWith('/api/v1/health')) {
    return next();
  }

  // Webhooks have their own cryptographic HMAC signature verification
  if (req.path.startsWith('/api/v1/webhooks/receive')) {
    return next();
  }

  const apiKeyHeader = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];

  let token = apiKeyHeader;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // In test environment or development without explicit auth enforcement, allow if no key is provided
  if (!process.env.ENFORCE_API_KEY && process.env.NODE_ENV !== 'production' && !token) {
    req.apiKey = 'dev-default-key';
    return next();
  }

  if (!token || token !== DEFAULT_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'A valid API key must be provided via X-API-Key header or Authorization: Bearer <key>',
    });
  }

  req.apiKey = token;
  next();
};

module.exports = { requireApiKey };
