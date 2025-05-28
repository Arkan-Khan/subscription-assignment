const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { userSignupSchema, userLoginSchema } = require('../validations/schemas');

router.post('/signup', validate(userSignupSchema), signup);
router.post('/login', validate(userLoginSchema), login);

module.exports = router; 