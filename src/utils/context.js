function buildContext(user) {
  return {
    userId:    user.userId,
    companyId: user.companyId,
    role:      user.role,
  }
}

module.exports = { buildContext }
