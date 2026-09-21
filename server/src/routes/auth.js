import { Router } from 'express';
import User from '../models/User.js';
import { allowRoles, requireAuth, signToken } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../utils/asyncHandler.js';
import { safeUser } from '../utils/serializers.js';

const router = Router();

router.get('/setup-status', asyncHandler(async (_req, res) => {
  res.json({ needsSetup: (await User.countDocuments()) === 0 });
}));

router.post('/setup', asyncHandler(async (req, res) => {
  if (await User.countDocuments()) throw new ApiError(409, 'The workspace has already been set up.');
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.');
  const user = await User.create({ name, email, password, role: 'OWNER' });
  res.status(201).json({ token: signToken(user), user: safeUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required.');
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !user.active || !(await user.matchesPassword(password))) throw new ApiError(401, 'Incorrect email or password.');
  res.json({ token: signToken(user), user: safeUser(user) });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));

router.get('/admins', requireAuth, allowRoles('OWNER'), asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json({ users: users.map(safeUser) });
}));

router.post('/admins', requireAuth, allowRoles('OWNER'), asyncHandler(async (req, res) => {
  const { name, email, password, role = 'ADMIN' } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required.');
  const user = await User.create({ name, email, password, role });
  res.status(201).json({ user: safeUser(user) });
}));

router.patch('/admins/:id', requireAuth, allowRoles('OWNER'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'Admin not found.');
  if (user.id === req.user.id && req.body.active === false) throw new ApiError(400, 'You cannot deactivate your own account.');
  ['name', 'role', 'active'].forEach((field) => { if (req.body[field] !== undefined) user[field] = req.body[field]; });
  await user.save();
  res.json({ user: safeUser(user) });
}));

export default router;
