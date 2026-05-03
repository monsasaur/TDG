require('dotenv').config()
const express = require('express')
const app = express()

app.use(express.json())
app.use(require('./middleware/auth'))

app.use('/api/v1/predict', require('./routes/predict'))
app.use('/api/v1/alert',   require('./routes/alert'))
app.use('/api/v1/events',  require('./routes/events'))
app.use('/api/v1/push',    require('./routes/push'))

app.get('/health', (req, res) => res.json({ 
  status: 'ok',
  timestamp: new Date().toISOString()
}))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`API running on port ${PORT}`))