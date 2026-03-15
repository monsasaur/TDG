const axios = require('axios')

const ML_URL = process.env.ML_SERVICE_URL

module.exports = {
  predict: async (features) => {
    try {
      const res = await axios.post(`${ML_URL}/predict`, 
        { features },
        { timeout: 5000 }
      )
      return res.data
    } catch (err) {
      throw new Error(`ML Service error: ${err.message}`)
    }
  }
}