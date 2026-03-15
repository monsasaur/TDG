require('dotenv').config()

let client = null

function getClient() {
  if (!client) {
    const twilio = require('twilio')
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }
  return client
}

function twilioReady() {
  return process.env.TWILIO_ACCOUNT_SID &&
         process.env.TWILIO_ACCOUNT_SID !== 'your_sid'
}

const LEVEL_LABEL = {
  A: 'ระดับ A — แจ้งเตือนเบา',
  B: 'ระดับ B — แจ้ง Caregiver',
  C: 'ระดับ C — ฉุกเฉิน'
}

const LEVEL_EMOJI = { A: '🟡', B: '🟠', C: '🔴' }

module.exports = {
  // SMS — Level B และ C
  notify: async ({ device_id, location, confidence, fall_level, duration_on_floor }) => {
    if (!twilioReady()) {
      console.log('⚠️  Twilio not configured — skip SMS')
      return
    }

    const label    = LEVEL_LABEL[fall_level] ?? 'ตรวจพบการล้ม'
    const emoji    = LEVEL_EMOJI[fall_level] ?? '🚨'
    const duration = duration_on_floor != null ? `${duration_on_floor} วิ` : '-'

    const message = [
      `${emoji} Fall Alert! ${label}`,
      `📍 Location   : ${location}`,
      `📟 Device     : ${device_id}`,
      `⏱️  บนพื้นนาน  : ${duration}`,
      `📊 Confidence : ${Math.round(confidence * 100)}%`,
      `🕐 เวลา       : ${new Date().toLocaleString('th-TH')}`
    ].join('\n')

    const recipients = process.env.ALERT_PHONES.split(',')

    await Promise.all(
      recipients.map(to =>
        getClient().messages.create({
          body: message,
          from: process.env.TWILIO_PHONE,
          to:   to.trim()
        })
      )
    )

    console.log(`✅ SMS (Level ${fall_level}) sent to ${recipients.length} recipients`)
  },

  // Voice Call — Level C เท่านั้น
  call: async ({ device_id, location, fall_level }) => {
    if (!twilioReady()) {
      console.log('⚠️  Twilio not configured — skip call')
      return
    }

    const recipients = process.env.ALERT_PHONES.split(',')

    await Promise.all(
      recipients.map(to =>
        getClient().calls.create({
          twiml: `
            <Response>
              <Say language="th-TH">
                แจ้งเตือนฉุกเฉิน พบผู้ล้มที่ ${location}
                ผู้ป่วยไม่สามารถลุกขึ้นได้ กรุณาตรวจสอบทันที
              </Say>
              <Pause length="1"/>
              <Say language="th-TH">
                แจ้งเตือนฉุกเฉิน พบผู้ล้มที่ ${location}
                กรุณาตรวจสอบทันที
              </Say>
            </Response>
          `,
          from: process.env.TWILIO_PHONE,
          to:   to.trim()
        })
      )
    )

    console.log(`✅ Voice call (Level ${fall_level}) made to ${recipients.length} recipients`)
  }
}
