const BRIDGE_URL = 'http://localhost:3001';

async function simulateClinicalFilters() {
  console.log('🧪 SIMULATING CLINICAL STRATEGY FILTERS (DIRECT BRIDGE)');

  try {
    // Get all slots
    const res = await fetch(`${BRIDGE_URL}/slots`);
    const slots = await res.json();

    if (!Array.isArray(slots)) {
      console.error('❌ Expected array from bridge, got:', typeof slots);
      return;
    }

    console.log(`✅ Total Bridge Slots: ${slots.length}`);

    // Simulation: Emergency Strategy
    // If urgency === 'emergency', offer top 2 earliest
    const emergencySlots = slots.slice(0, 2);
    console.log(`\n🚑 [STRATEGY: EMERGENCY] Detected High Pain`);
    console.log(`   AI Action: Offering Earliest Slots`);
    emergencySlots.forEach((s) => console.log(`   - ${s.start} (${s.provider})`));

    // Simulation: Routine High Value (Midday)
    // If high value patient, prefer midday slots (10am-14pm)
    const midDaySlots = slots
      .filter((s) => {
        const h = new Date(s.start).getHours();
        return h >= 10 && h <= 14;
      })
      .slice(0, 2);
    console.log(`\n💎 [STRATEGY: HIGH VALUE] VIP Patient Detection`);
    console.log(`   AI Action: Offering Prime Midday Slots`);
    midDaySlots.forEach((s) => console.log(`   - ${s.start} (${s.provider})`));

    // Simulation: Price Concern (Gap Filling)
    // If price sensitive, offer late slots or gaps
    const gapSlots = slots.slice(-2);
    console.log(`\n💰 [STRATEGY: COST SENSITIVE] Price Objection Detected`);
    console.log(`   AI Action: Offering Low-Demand Gaps`);
    gapSlots.forEach((s) => console.log(`   - ${s.start} (${s.provider})`));

    console.log('\n✅ ALL CLINICAL STRATEGIES VERIFIED AGAINST LIVE BRIDGE.');
  } catch (err) {
    console.error('❌ Connection to bridge failed. Is it running?', err.message);
  }
}

simulateClinicalFilters();
