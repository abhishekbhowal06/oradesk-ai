# 📜 SERVICE LEVEL AGREEMENT (SLA)

**Version:** 2.0 (Enterprise Scaling Phase)  
**Last Updated:** 2026-02-25  

This document outlines the service availability and support commitments for OraDesk AI.

---

## 1. Availability Commitment

OraDesk AI commits to a **99.9% Monthly Uptime Percentage**.

| Status | Threshold | Definition |
| :--- | :--- | :--- |
| **Operational** | ≥ 99.9% | System is processing calls and responding to API requests normally. |
| **Degraded** | 98% - 99.8% | Intermittent latency in AI inference or Dashboard updates. |
| **Outage** | < 98% | Complete failure of the Voice Network or Database layer. |

---

## 2. Incident Response Times

We classify incidents based on their impact on patient care and clinic operations.

| Severity | Description | Response Goal | Resolution Goal |
| :--- | :--- | :--- | :--- |
| **P1 - Critical** | Global platform outage or security breach. | < 15 Minutes | < 4 Hours |
| **P2 - High** | Total failure of AI calling for a specific clinic. | < 30 Minutes | < 8 Hours |
| **P3 - Medium** | Degradation in Dashboard analytics or reporting. | < 2 Hours | < 24 Hours |
| **P4 - Low** | Minor cosmetic UI issues or documentation errors. | < 12 Hours | < 72 Hours |

---

## 3. Scheduled Maintenance

Maintenance windows are used to perform infrastructure upgrades (e.g., database scaling, multi-region failover tests).

- **Notice Period:** Minimum 48 hours via admin dashboard banner.
- **Window:** Sundays 02:00 - 04:00 EST (Targeting lowest clinical volume).
- **Target:** Zero-downtime rolling updates (Blue/Green deployments).

---

## 4. Business Continuity

- **Data Redundancy:** Database snapshots every 6 hours cross-region.
- **Failover:** Automatic multi-region steerage via GCP Global Load Balancing.
- **Support:** 24/7 Monitoring via PagerDuty for P1/P2 incidents.

---

## 5. Contact Information

- **Technical Support:** support@oradesk.com
- **Emergency Incident Hotline:** (Provisioned for Platinum Tier Clinics)
- **Status Page:** `https://api.oradesk.com/v2/ops/public-status` (via HTML Accept header)
