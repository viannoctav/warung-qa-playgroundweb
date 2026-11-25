const express = require('express');
const { createAuthService } = require('../services/auth-service');
const authDeps = require('../services/auth-deps');
const { createNotificationService } = require('../services/notification-service');
const notificationRepo = require('../repositories/notifications');
const { sendError, sendResult } = require('../http');
const { MESSAGES } = require('../config');

const router = express.Router();
const auth = createAuthService(authDeps);
const notifications = createNotificationService(notificationRepo);

async function requireUser(req, res, next) {
  const user = await auth.authenticate(req.get('authorization'));
  if (!user) return sendError(res, 401, 'UNAUTHORIZED', MESSAGES.unauthorized);
  req.user = user;
  return next();
}

router.use('/notifications', requireUser);

// read-all didaftarkan sebelum /:id
router.post('/notifications/read-all', async (req, res) => sendResult(res, await notifications.markAllRead(req.user)));
router.get('/notifications', async (req, res) => sendResult(res, await notifications.list(req.user, req.query)));
router.post('/notifications/:id/read', async (req, res) => sendResult(res, await notifications.markRead(req.user, req.params.id)));

module.exports = router;
