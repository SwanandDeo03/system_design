const client = require('prom-client');

const register = new client.Registry();

// Collect default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

register.registerMetric(httpRequestDurationSeconds);

function middleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    try {
      const diff = process.hrtime(start);
      const seconds = diff[0] + diff[1] / 1e9;
      const route = req.route && req.route.path ? req.route.path : req.path || req.originalUrl || 'unknown';
      httpRequestDurationSeconds.labels(req.method, route, String(res.statusCode)).observe(seconds);
    } catch (err) {
      // avoid throwing from metrics
    }
  });

  next();
}

module.exports = {
  register,
  middleware,
  client
};
