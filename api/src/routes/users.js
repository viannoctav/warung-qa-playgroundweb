const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createUserAdminService } = require('../services/user-admin-service');
const { sendError, sendResult } = require('../http');
const { MESSAGES } = require('../config');

const router = express.Router();
const auth = createAuthService(authDeps);
// authDeps berisi repository users + hashPassword
const admin = createUserAdminService(authDeps);

async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

router.use('/users', requireUser);

// bulk-delete didaftarkan sebelum /users/:id
router.post('/users/bulk-delete', async (req, res) => sendResult(res, await admin.bulkDelete(req.user, req.body)));
router.get('/users', async (req, res) => sendResult(res, await admin.list(req.user, req.query)));
router.get('/users/:id', async (req, res) => sendResult(res, await admin.get(req.user, req.params.id)));
router.patch('/users/:id', async (req, res) => sendResult(res, await admin.update(req.user, req.params.id, req.body)));
router.put('/users/:id/password', async (req, res) =>
  sendResult(res, await admin.changePassword(req.user, req.params.id, req.body)));
router.delete('/users/:id', async (req, res) => sendResult(res, await admin.remove(req.user, req.params.id)));

module.exports = router;
