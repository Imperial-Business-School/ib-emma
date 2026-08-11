/** @type {import('next').NextConfig} */
const nextConfig = {
  // Baked into the build so the running app can display which commit
  // it's on and when the deploy happened. VERCEL_GIT_COMMIT_SHA and
  // VERCEL_GIT_COMMIT_REF are set by Vercel on every build.
  env: {
    APP_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.APP_COMMIT_SHA ||
      "dev",
    APP_BUILD_TIME: new Date().toISOString(),
  },
};

module.exports = nextConfig;
