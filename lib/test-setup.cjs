// Loaded before every test (see "test" in package.json). The handler tests sign in with the demo x-user-id header,
// which the app only accepts when ENABLE_DEV_USER_HEADER=true. This keeps `npm test` working without setting it by hand.
process.env.ENABLE_DEV_USER_HEADER = 'true';
