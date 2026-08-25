// Extends app.json. Expo passes the parsed app.json as `config`. We add
// build-time overrides (e.g. paths materialized from EAS file env vars).

module.exports = ({ config }) => {
  const android = { ...(config.android || {}) };

  // EAS file env var: at build time, GOOGLE_SERVICES_JSON resolves to the
  // absolute path of the materialized google-services.json. Locally we
  // fall back to ./google-services.json (gitignored).
  if (process.env.GOOGLE_SERVICES_JSON) {
    android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }

  return {
    ...config,
    android,
  };
};
