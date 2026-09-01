const crypto = require('crypto')

function loadService(env = {}) {
  jest.resetModules()
  for (const key of [
    'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH',
    'ADMIN_SESSION_HOURS', 'ADMIN_MAX_LOGIN_ATTEMPTS'
  ]) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  return require('../src/services/adminAuthService')
}

// hash ที่ใช้ร่วมกันทุกเทสต์ — scrypt ช้าโดยตั้งใจ คำนวณครั้งเดียวพอ
const PASSWORD = 'correct-horse-battery'
const SALT     = crypto.randomBytes(16)
const HASH     = `scrypt$${SALT.toString('hex')}$${crypto.scryptSync(PASSWORD, SALT, 64).toString('hex')}`

const CONFIGURED = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: HASH }

describe('adminAuthService.isConfigured', () => {
  test('false when username/hash missing', () => {
    expect(loadService({}).isConfigured()).toBe(false)
  })

  test('true when both are set', () => {
    expect(loadService(CONFIGURED).isConfigured()).toBe(true)
  })
})

describe('adminAuthService.login', () => {
  test('rejects when auth is not configured (fails closed)', () => {
    const svc = loadService({})
    const res = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })
    expect(res).toEqual({ ok: false, reason: 'not_configured' })
  })

  test('issues a token for correct credentials', () => {
    const svc = loadService(CONFIGURED)
    const res = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })

    expect(res.ok).toBe(true)
    expect(typeof res.token).toBe('string')
    expect(res.token.length).toBeGreaterThanOrEqual(32)
    expect(new Date(res.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  test('rejects wrong password with the same reason as wrong username (SEC-09)', () => {
    const svc = loadService(CONFIGURED)
    const wrongPass = svc.login({ username: 'admin',   password: 'nope',   ip: '1.1.1.1' })
    const wrongUser = svc.login({ username: 'someone', password: PASSWORD, ip: '2.2.2.2' })

    expect(wrongPass).toEqual({ ok: false, reason: 'invalid_credentials' })
    expect(wrongUser).toEqual({ ok: false, reason: 'invalid_credentials' })
  })

  test('rate limits after too many failures from the same ip (SEC-08)', () => {
    const svc = loadService({ ...CONFIGURED, ADMIN_MAX_LOGIN_ATTEMPTS: '3' })

    for (let i = 0; i < 3; i++) {
      expect(svc.login({ username: 'admin', password: 'bad', ip: '9.9.9.9' }).reason)
        .toBe('invalid_credentials')
    }

    const blocked = svc.login({ username: 'admin', password: PASSWORD, ip: '9.9.9.9' })
    expect(blocked).toEqual({ ok: false, reason: 'rate_limited' })

    // ip อื่นไม่ควรโดนล็อกไปด้วย
    expect(svc.login({ username: 'admin', password: PASSWORD, ip: '8.8.8.8' }).ok).toBe(true)
  })

  test('a successful login clears the failure counter', () => {
    const svc = loadService({ ...CONFIGURED, ADMIN_MAX_LOGIN_ATTEMPTS: '3' })

    svc.login({ username: 'admin', password: 'bad', ip: '5.5.5.5' })
    svc.login({ username: 'admin', password: 'bad', ip: '5.5.5.5' })
    expect(svc.login({ username: 'admin', password: PASSWORD, ip: '5.5.5.5' }).ok).toBe(true)

    svc.login({ username: 'admin', password: 'bad', ip: '5.5.5.5' })
    svc.login({ username: 'admin', password: 'bad', ip: '5.5.5.5' })
    // ถ้าตัวนับไม่ถูกล้าง ครั้งนี้จะกลายเป็น rate_limited
    expect(svc.login({ username: 'admin', password: PASSWORD, ip: '5.5.5.5' }).ok).toBe(true)
  })
})

describe('adminAuthService.verify / logout', () => {
  test('verifies a fresh token and rejects an unknown one', () => {
    const svc = loadService(CONFIGURED)
    const { token } = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })

    expect(svc.verify(token)).toMatchObject({ username: 'admin' })
    expect(svc.verify('not-a-real-token')).toBeNull()
    expect(svc.verify(null)).toBeNull()
  })

  test('expires a session that has been idle past the ttl (SEC-04)', () => {
    const svc = loadService(CONFIGURED)
    const { token } = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })

    const nineHoursLater = Date.now() + 9 * 60 * 60 * 1000
    jest.spyOn(Date, 'now').mockReturnValue(nineHoursLater)

    expect(svc.verify(token)).toBeNull()
    Date.now.mockRestore()
  })

  test('keeps a session alive while it is being used', () => {
    const svc = loadService(CONFIGURED)
    const { token } = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })

    // ใช้งานทุก 7 ชั่วโมง ติดกัน 3 รอบ — ไม่ควรหมดอายุเพราะนับจากครั้งล่าสุด
    const start = Date.now()
    const spy   = jest.spyOn(Date, 'now')
    for (let i = 1; i <= 3; i++) {
      spy.mockReturnValue(start + i * 7 * 60 * 60 * 1000)
      expect(svc.verify(token)).not.toBeNull()
    }
    spy.mockRestore()
  })

  test('logout invalidates the token', () => {
    const svc = loadService(CONFIGURED)
    const { token } = svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' })

    expect(svc.logout(token)).toBe(true)
    expect(svc.verify(token)).toBeNull()
    expect(svc.logout(undefined)).toBe(false)
  })
})

describe('adminAuthService.hashPassword', () => {
  test('same password with different salts produces different hashes', () => {
    const svc = loadService({})
    expect(svc.hashPassword('same-password')).not.toBe(svc.hashPassword('same-password'))
  })

  test('a malformed stored hash never authenticates', () => {
    for (const bad of ['', 'plaintext', 'scrypt$only-two', 'md5$aa$bb', 'scrypt$zz$short']) {
      const svc = loadService({ ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: bad })
      expect(svc.login({ username: 'admin', password: PASSWORD, ip: '1.1.1.1' }).ok)
        .toBe(false)
    }
  })
})
