const express = require('express');
const { createAuthService } = require('../services/auth-service');
const deps = require('../services/auth-deps');
const { sendResult } = require('../http');

const router = express.Router();
const auth = createAuthService(deps);

router.post('/auth/login', async (req, res) => {
  sendResult(res, await auth.login(req.body));
});

router.get('/me', async (req, res) => {
  sendResult(res, await auth.me(req.get('authorization')));
});

router.post('/reset', async (req, res) => {
  sendResult(res, await auth.reset(req.get('authorization')));
});

module.exports = router;
