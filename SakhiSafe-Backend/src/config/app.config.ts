export default () => ({
  app: {
    name: process.env.APP_NAME ?? 'SakhiSafe Backend',
    port: Number(process.env.APP_PORT ?? 4000),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
});
