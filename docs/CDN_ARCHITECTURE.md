# ⚡ CDN & EDGE ARCHITECTURE

**Classification:** CONFIDENTIAL - INTERNAL ONLY  

This document outlines the Content Delivery Network (CDN) and Edge protection strategy for OraDesk AI.

---

## 1. Edge Strategy

We utilize a multi-layered Edge approach to minimize latency and protect against automated threats.

### Layer 1: Global Anycast IP (GCP Global Load Balancer)
- Serves as the single entry point for all API (`/v2`) and Stream (`/v1/streams`) traffic.
- Performs automatic geographic routing to the nearest Cloud Run instance (US vs. EU).

### Layer 2: Cloud CDN (Built-into GLB)
- **Caching Policy:** Static assets (`index.css`, `bundle.js`, images) are cached at 100+ Edge locations.
- **TTL:** 1 Year for versioned assets; 5 Minutes for the public status page.

---

## 2. Security at the Edge (Cloud Armor)

To satisfy **SOC2 compliance**, we enforce the following WAF rules at the CDN layer:

1. **DDoS Protection:** Automatic rate limiting based on volumetric threshold.
2. **Geo-Blocking:** Restricted traffic from high-risk sanctioned regions.
3. **SQLi/XSS Filtering:** Inspection of incoming request bodies for common attack vectors.

---

## 3. Configuration (GCP Terraform/CLI)

### Cache Control for Static Assets
```bash
# Example for forcing cache refresh on frontend update
gcloud compute url-maps invalidate-cdn-cache ai-calling-glb \
    --path "/*"
```

### Protocol Support
- **HTTP/3 (QUIC):** Enabled for lower handshake latency on mobile networks.
- **GRPC:** Supported for bridge-to-cloud low-latency telemetry.
- **WebSockets:** Keep-alive timeout tuned to 3600s for long-duration AI calls.
