const express = require('express');
const router = express.Router();
const { getAllPlans } = require('../controllers/planController');
const auth = require('../middlewares/auth');

router.get('/', auth, getAllPlans);

module.exports = router; 