const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
// Minimal internal logger respecting environment (avoid repeated eslint disables)
function devLog(...args) { if (process.env.NODE_ENV !== 'production') { console.log(...args); } }
function devError(...args) { if (process.env.NODE_ENV !== 'production') { console.error(...args); } }
const http = require('http');
const { Server } = require('socket.io');
const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000','http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean),
    credentials: true
  }
});

// Configure CORS with specific origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://kgamify-job-portal.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean); // Filter out undefined values

// CORS origins configured for production

// Apply CORS middleware before defining routes
app.use(cors({
  origin (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, or same-origin)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Origin not allowed by CORS policy
      // Still allowing all origins in development for easier debugging
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-auth-token', 'company-email', 'company-auth', 'x-request-id', 'X-Request-ID', 'X-Client-Version', 'X-Client-Platform', 'x-api-key', 'Cache-Control', 'Pragma']
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Increase JSON payload size limit
// Razorpay webhook requires raw body for signature verification; mount raw parser for its path first
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const payments = require('./routes/payments');
    return payments.webhook(req, res);
  } catch (e) {
    return res.status(500).json({ error: 'Webhook internal error' });
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add a test endpoint to verify CORS is working
app.get('/api/cors-test', (req, res) => {
  res.json({ 
    message: 'CORS is working correctly',
    origin: req.headers.origin || 'No origin header' 
  });
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Unauthorized" });
    req.user = decoded.user;
    next();
  });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/company'));
app.use('/api/application', require('./routes/application'));
app.use('/api/job', require('./routes/job'));
app.use('/api/notifications', require('./routes/notifications'));

// External API routes (public endpoints)
const externalRoutes = require('./routes/external');
app.use('/api/external', externalRoutes);

// Admin routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin', externalRoutes); // Mount external routes for admin API key management
app.use('/api/admin-management', require('./routes/adminManagement'));

app.use('/api/payments', require('./routes/payments'));

// Protected route
app.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "You are authorized", user: req.user });
});

// Add header debug endpoint to check if CORS headers are being applied
app.get('/api/debug/headers', (req, res) => {
  res.json({
    headers: req.headers,
    origin: req.headers.origin,
    corsEnabled: true
  });
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Connect to MongoDB
 
mongoose.connect(process.env.MONGO_URI)
  .then(() => { devLog('MongoDB connected'); })
  .catch(err => { devError('MongoDB connection error:', err); });

// Socket.io basic events
io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
  socket.on('leave', (room) => socket.leave(room));
});

// Expose emitter for routes
app.set('io', io);

// Start server
server.listen(port, () => { devLog(`Server is running on http://localhost:${port}`); });

// Add error handler middleware
app.use((err, req, res, next) => {
  (void next); // ensure four-arg signature recognized & avoid unused var lint
  // eslint-disable-next-line no-console
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});