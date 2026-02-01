import axios from 'axios';

const API_URL = process.env.CONEKO_API_URL || 'http://localhost:3000';

/**
 * E2E Test Setup
 * 
 * This file runs before all E2E tests to verify the environment is ready.
 */

beforeAll(async () => {
  // Wait for service to be healthy
  console.log(`Checking service health at ${API_URL}/health...`);
  
  let retries = 30;
  while (retries > 0) {
    try {
      const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
      if (response.status === 200) {
        console.log('✓ Service is healthy');
        return;
      }
    } catch (error) {
      console.log(`Waiting for service... (${retries} retries left)`);
    }
    retries--;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Service did not become healthy in time');
});

/**
 * Clean up function to run after all tests
 */
afterAll(async () => {
  // Any global cleanup can go here
  console.log('E2E tests completed');
});
