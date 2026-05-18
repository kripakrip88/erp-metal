const jwt = require('jsonwebtoken')

const SECRET = process.env.JWT_SECRET
const EXPIRY = '8h'

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY })
}

function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

module.exports = { signToken, verifyToken }