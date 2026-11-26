require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const Reading = require('./models/Reading');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.get('/', (req, res) => res.send('API running'));

// REGISTER
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields required' });
    }
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    res.status(201).json({ id: user._id, name: user.name, email: user.email });
  } catch (err) {
    next(err);
  }
});

// LOGIN
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// PROTECT middleware
const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// PROTECTED route
app.get('/api/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});
// DEVICE AUTH middleware (API key, for sensors)
const deviceAuth = (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({ message: 'Invalid device key' });
  }
  next();
};

// DEVICE posts a reading
app.post('/api/readings', deviceAuth, async (req, res, next) => {
  try {
    const { device, temperature, humidity } = req.body;
    if (!device || typeof temperature !== 'number') {
      return res.status(400).json({ message: 'device and numeric temperature required' });
    }
    const reading = await Reading.create({ device, temperature, humidity });
    res.status(201).json(reading);
  } catch (err) {
    next(err);
  }
});

// DASHBOARD: list readings (filters + pagination)
app.get('/api/readings', protect, async (req, res, next) => {
  try {
    const { device, from, to } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const filter = {};
    if (device) filter.device = device;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const readings = await Reading.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Reading.countDocuments(filter);
    res.json({ page, limit, total, readings });
  } catch (err) {
    next(err);
  }
});

// DASHBOARD: latest reading
app.get('/api/readings/latest', protect, async (req, res, next) => {
  try {
    const filter = req.query.device ? { device: req.query.device } : {};
    const reading = await Reading.findOne(filter).sort({ timestamp: -1 });
    if (!reading) return res.status(404).json({ message: 'No readings yet' });
    res.json(reading);
  } catch (err) {
    next(err);
  }
});
// DASHBOARD: list distinct devices
app.get('/api/devices', protect, async (req, res, next) => {
  try {
    const devices = await Reading.distinct('device');
    res.json(devices);
  } catch (err) {
    next(err);
  }
});
// ERROR middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

// Connect to DB first, then start the server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(5000, () => console.log('Server on 5000'));
  })
  .catch((err) => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });