module.exports = (req, res, next) => {
  if (req.path === '/health') return next()

  const key = req.headers['x-api-key']
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}