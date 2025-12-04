// Jest setup file - runs before each test file
import { beforeEachSetup, afterEachTeardown } from './globalSetup';

// Setup before each test file
beforeEach(async () => {
  await beforeEachSetup();
});

// Teardown after each test file
afterEach(async () => {
  await afterEachTeardown();
});

