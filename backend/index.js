const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// ฟังก์ชันสร้างข้อมูลใหม่
function generateDevices() {
  return [
    { 
      id: 1, 
      name: 'Temperature Sensor', 
      status: Math.random() > 0.5 ? 'ON' : 'OFF', 
      value: Math.floor(Math.random() * 100) + '%' 
    },
    { 
      id: 2, 
      name: 'Humidity Sensor', 
      status: Math.random() > 0.5 ? 'ON' : 'OFF', 
      value: Math.floor(Math.random() * 100) + '%' 
    },
  ]
}

app.get('/api/devices', (req, res) => {
  res.json(generateDevices()) // เรียกใหม่ทุกครั้ง
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})