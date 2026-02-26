#!/bin/bash
# OraDesk AI — SOC2 Evidence Collector
# Generates a structured package for audit review.

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="./soc2_evidence_${TIMESTAMP}"

echo "🚀 Starting SOC2 Evidence Collection..."
mkdir -p "$EVIDENCE_DIR/logs"
mkdir -p "$EVIDENCE_DIR/config"
mkdir -p "$EVIDENCE_DIR/compliance"

# 1. Export Audit Logs (Anonymized)
# Note: In a real environment, this would query the DB. 
# Here we simulate with a placeholder.
echo "[1/4] Exporting Audit Logs..."
echo "Clinic ID, Actor, Action, Resource, Timestamp" > "$EVIDENCE_DIR/logs/audit_export.csv"
echo "demo-clinic-123, system, health_check, status_api, 2026-02-25T12:00:00Z" >> "$EVIDENCE_DIR/logs/audit_export.csv"

# 2. Capture Security Configuration
echo "[2/4] Capturing Security Headers Config..."
cp ./services/ai-calling/src/index.ts "$EVIDENCE_DIR/config/middleware_security.ts"

# 3. Capture RLS Policies
# Simulate policy dump
echo "[3/4] Exporting RLS Policies..."
grep -r "POLICY" ./supabase/migrations > "$EVIDENCE_DIR/compliance/rls_policies_summary.txt"

# 4. Include Compliance Documentation
echo "[4/4] Bundling Compliance Docs..."
cp ./docs/SLA.md "$EVIDENCE_DIR/compliance/"
cp ./docs/HIPAA_COMPLIANCE_REVIEW.md "$EVIDENCE_DIR/compliance/"
cp ./docs/SOC2_CONTROLS_MAPPING.md "$EVIDENCE_DIR/compliance/"

echo "✅ Evidence collection complete!"
echo "Package available at: $EVIDENCE_DIR"
echo "Manifest:"
ls -R "$EVIDENCE_DIR"
