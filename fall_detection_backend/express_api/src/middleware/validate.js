module.exports = {
  predictBody: (req, res, next) => {
    const { device_id, features } = req.body

    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' })
    }

    // features = array of arrays (seq_len, 416)
    if (!features || !Array.isArray(features) || features.length === 0) {
      return res.status(400).json({ error: 'features must be a non-empty array' })
    }

    if (!Array.isArray(features[0])) {
      return res.status(400).json({ error: 'features must be array of arrays [[...], [...]]' })
    }

    next()
  }
}