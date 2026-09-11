import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

const createAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    }
  );
};

const createRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/auth'
  });
};

const getUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.created_at
});

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, 'developer']
    );

    const user = result.rows[0];

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    setRefreshCookie(res, refreshToken);

    res.status(201).json({
      accessToken,
      user: getUserResponse(user)
    });
  } catch (error) {
    console.error('Register error:', error);

    res.status(500).json({
      error: 'Registration failed'
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await query(
      `SELECT id, name, email, password_hash, role, created_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);

    setRefreshCookie(res, refreshToken);

    res.json({
      accessToken,
      user: getUserResponse(user)
    });
  } catch (error) {
    console.error('Login error:', error);

    res.status(500).json({
      error: 'Login failed'
    });
  }
};

export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({
      error: 'Refresh token not provided'
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET
    );

    const result = await query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    const accessToken = createAccessToken(user);

    res.json({
      accessToken,
      user: getUserResponse(user)
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token expired'
      });
    }

    return res.status(401).json({
      error: 'Invalid refresh token'
    });
  }
};

export const logout = async (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/auth'
  });

  res.json({
    message: 'Logged out successfully'
  });
};

export const getCurrentUser = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Get current user error:', error);

    res.status(500).json({
      error: 'Failed to fetch user'
    });
  }
};