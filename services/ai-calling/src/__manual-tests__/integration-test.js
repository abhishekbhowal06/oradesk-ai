const axios = require('axios');
const API_URL = 'http://localhost:3000/v1';

async function runIntegrationTest() {
  console.log('🧪 STARTING INDUSTRIAL GRADE INTEGRATION TEST (JS Mode)');

  const timestamp = Date.now();
  const testEmail = `test_${timestamp}@dentacor.com`;
  const testPassword = 'Password123!';
  const testName = 'Test Doctor';

  try {
    // 1. SIGNUP (via Backend API)
    console.log(`\nTesting Signup for ${testEmail}...`);
    const signupRes = await axios.post(`${API_URL}/auth/signup`, {
      email: testEmail,
      password: testPassword,
      full_name: testName,
      clinic_name: 'Test Clinic',
    });

    if (signupRes.status !== 200)
      throw new Error('Signup failed: ' + JSON.stringify(signupRes.data));
    console.log('✅ Signup Successful');

    // Verify Clinic Created
    const clinicId = signupRes.data.clinic.id;
    console.log(`   Clinic ID: ${clinicId}`);
    const userId = signupRes.data.user.id;
    console.log(`   User ID: ${userId}`);

    // 2. FORGOT PASSWORD
    console.log('\nTesting Forgot Password...');
    const forgotRes = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: testEmail,
    });
    if (forgotRes.status !== 200) throw new Error('Forgot Password failed');
    console.log('✅ Forgot Password Triggered');

    // 3. INVITE STAFF (Simulate by just hitting endpoint, usually requires auth)
    // Since we are running in backend context, we might not have a valid token easily without login.
    // Let's TRY to login via Supabase REST API if possible, or just skip if too complex for simple script.
    // Actually, let's just assert the endpoint exists and returns 401 (Unauthorized) which proves it's protected.
    // If we want 200, we need a token.

    console.log('\nTesting Auth Protection on Invite...');
    try {
      await axios.post(`${API_URL}/auth/invite`, {
        email: 'fail@test.com',
      });
      throw new Error('Should have failed with 401');
    } catch (e) {
      if (e.response && e.response.status === 401) {
        console.log('✅ Invite endpoint is correctly protected (401 received)');
      } else {
        throw e;
      }
    }

    // 4. BILLING CHECKOUT
    console.log('\nTesting Billing Checkout (Protected)...');
    try {
      await axios.post(`${API_URL}/billing/checkout`, {
        tier: 'pro',
        clinic_id: clinicId,
        success_url: 'http://localhost',
        cancel_url: 'http://localhost',
      });
      throw new Error('Should have failed with 401');
    } catch (e) {
      if (e.response && e.response.status === 401) {
        console.log('✅ Billing endpoint is correctly protected (401 received)');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 ALL INDUSTRIAL GRADE TESTS PASSED!');
  } catch (error) {
    console.error('❌ TEST FAILED FULL ERROR:', error);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

runIntegrationTest();
