#!/bin/bash
# OWASP ZAP Security Scan Script
# Run with: bash tests/security/run-owasp-scan.sh

TARGET_URL="${1:-http://localhost:5173}"
REPORT_DIR="./tests/security/reports"

echo "🔒 OWASP ZAP Security Scan"
echo "Target: $TARGET_URL"
echo ""

# Create reports directory
mkdir -p $REPORT_DIR

# Check if ZAP is installed
if ! command -v zap-cli &> /dev/null; then
    echo "❌ zap-cli not found. Install OWASP ZAP first:"
    echo "   pip install zapcli"
    echo "   Or use Docker: docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $TARGET_URL"
    echo ""
    echo "🐳 Docker command (recommended):"
    echo "   docker run -v \$(pwd)/tests/security/reports:/zap/wrk:rw \\"
    echo "     -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \\"
    echo "     -t $TARGET_URL -r report.html"
    exit 1
fi

echo "Starting ZAP scan..."

# Quick baseline scan
zap-cli quick-scan --self-contained \
    --start-options "-config api.disablekey=true" \
    $TARGET_URL

# Generate report
echo ""
echo "📄 Generating report..."
zap-cli report -o $REPORT_DIR/zap-report.html -f html

echo ""
echo "✅ Scan complete!"
echo "📁 Report saved to: $REPORT_DIR/zap-report.html"
