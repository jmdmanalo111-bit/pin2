// server.js — Static hosting for PIN Valuations (CommonJS)
// Place your site files under ./public (public/index.html, public/images, public/pages, public/style.css)

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind a proxy/load balancer (Heroku/Render/etc.)
app.set('trust proxy', 1);

// Logging (dev)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Gzip/Brotli (via proxies) compression
app.use(compression());

// Baseline secure headers (we'll set our own CSP below)
app.use(helmet({ contentSecurityPolicy: false }));

// Content-Security-Policy tuned to your current HTML
// Allows: inline scripts/styles (for your helper JS & preload swap),
// Bootstrap/Icons via jsDelivr, GA/gtag, and your own images under pin.ca
const cspDirectives = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com"
  ],
  "style-src": [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.jsdelivr.net"
  ],
  "img-src": [
    "'self'",
    'data:',
    'https://www.pin.ca' // og images, icons
  ],
  "font-src": [
    "'self'",
    "https://cdn.jsdelivr.net"
  ],
  "connect-src": [
    "'self'",
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com'
  ],
  "frame-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "upgrade-insecure-requests": []
};

app.use((req, res, next) => {
  const policy = Object.entries(cspDirectives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
  res.setHeader('Content-Security-Policy', policy);
  next();
});

// HSTS (enable only when site is fully served over HTTPS in prod)
if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet.hsts({
      maxAge: 60 * 60 * 24 * 30, // 30 days
      includeSubDomains: true,
      preload: false
    })
  );
}

// Correct MIME types for a few assets
app.get('*.webmanifest', (req, res, next) => { res.type('application/manifest+json'); next(); });
app.get('*.svg', (req, res, next) => { res.type('image/svg+xml'); next(); });
app.get('*.webp', (req, res, next) => { res.type('image/webp'); next(); });

// Optional: force apex domain (redirect www -> apex)
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    return res.redirect(301, `https://${host.slice(4)}${req.originalUrl}`);
  }
  next();
});

const publicDir = path.join(__dirname, 'public');

// Asset caching: cache everything except HTML for 30 days
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30d
  }
  next();
});

// Serve static files
app.use(express.static(publicDir, { etag: true, extensions: ['html'] }));

// Ensure HTML pages are always fresh (no-store)
app.get(['/', '/*.html'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
});

// Root -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Pretty 404 page if available, else plain text
app.use((req, res) => {
  res.status(404);
  res.sendFile(path.join(publicDir, '404.html'), (err) => {
    if (err) res.type('text/plain').send('404 Not Found');
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).type('text/plain').send('500 Internal Server Error');
});

app.listen(PORT, () => {
  console.log(`✅ PIN Valuations server running at http://localhost:${PORT}`);
});
