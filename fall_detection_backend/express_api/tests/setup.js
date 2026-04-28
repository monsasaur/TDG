jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }))

const KEYS = [
  'API_KEY', 'ML_SERVICE_URL', 'USE_MOCK_ML', 'MOCK_IS_FALL',
  'ACK_TIMEOUT_SECONDS', 'COOLDOWN_SECONDS',
  'TWILIO_MODE', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE',
  'ALERT_PHONES', 'SUPABASE_URL', 'SUPABASE_KEY'
]
for (const k of KEYS) delete process.env[k]
