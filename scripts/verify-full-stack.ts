import { execSync } from 'child_process';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'services/ai-calling/.env') });

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';

async function checkBackendHealth() {
  console.log('🔍 Checking Backend Health...');
  try {
    const response = await axios.get(`${SERVICE_URL}/health`);
    if (response.status === 200) {
      console.log('✅ Backend is healthy');
      return true;
    } else {
      console.error(`❌ Backend returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Backend health check failed:', (error as any).message);
    return false;
  }
}

function checkFrontendBuild() {
  console.log('🔍 Checking Frontend Build...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Frontend build successful');
    return true;
  } catch (error) {
    console.error('❌ Frontend build failed');
    return false;
  }
}

async function run() {
  console.log('🚀 Starting Full Stack Verification...');

  // 1. Backend Health (Assuming server is running or we start it - for now just check)
  // In a real CI, we'd start it. Here we assume 'npm run dev' is up or we fail.
  const backendOk = await checkBackendHealth();

  // 2. Frontend Build
  const frontendOk = checkFrontendBuild();

  if (backendOk && frontendOk) {
    console.log('✅✅ FULL STACK VERIFIED');
    process.exit(0);
  } else {
    console.error('❌❌ VERIFICATION FAILED');
    process.exit(1);
  }
}

run();
