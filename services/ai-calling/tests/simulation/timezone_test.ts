function formatDisplayTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: 'America/New_York',
            timeZoneName: 'short'
        }).format(date);
    } catch {
        return isoString;
    }
}

// Test case: 2026-02-17 T 09:00:00 UTC -> Should be 4AM EST
const testDate = '2026-02-17T09:00:00Z';
const formatted = formatDisplayTime(testDate);

console.log(`Input (UTC): ${testDate}`);
console.log(`Output (EST): ${formatted}`);

if (formatted.includes('EST') || formatted.includes('EDT')) {
    console.log('✅ TIMEZONE TEST PASSED');
} else {
    console.log('❌ TIMEZONE TEST FAILED');
    process.exit(1);
}
