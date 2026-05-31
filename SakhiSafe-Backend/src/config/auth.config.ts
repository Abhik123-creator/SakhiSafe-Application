export default () => ({
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change_this_to_a_long_random_secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  },
});
