export default {
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],

  testMatch: ["**/*.test.js"],

  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  transform: {},

  verbose: true,

  forceExit: true,

  detectOpenHandles: true,
};
