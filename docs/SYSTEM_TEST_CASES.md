# ELS Construction (Pvt) Ltd - Construction Material Management System (CMMS)
## System Test Specification & Execution Log (Comprehensive Viva Test Report)

This document provides a complete manual test suite for the CMMS platform, covering end-to-end multi-role workflows across all 6 operational roles.

---

### Test Execution Summary

| Test ID | Module | Role | Test Scenario | Pre-conditions | Test Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **TC01** | **Auth & RBAC** | Guest / User | User Authentication & Role Route Guard | System running with seeded accounts | 1. Attempt accessing `/api/purchase-orders` without JWT token.<br/>2. Log in as `SiteStoreOfficer`.<br/>3. Attempt accessing Admin user management endpoints. | Unauthorized request receives HTTP 401. Route access restricted by role permission matrix with HTTP 403. | HTTP 401 & 403 returned as expected. | **PASS** |
| **TC02** | **Project Management** | Project Manager | Project Creation & Architectural Drawing Upload | Logged in as `pm@elslanka.com` | 1. Navigate to Projects tab.<br/>2. Click "Create Project".<br/>3. Fill project details (PRJ-2026-002).<br/>4. Attach PDF drawing file and submit. | Project created successfully. Uploaded drawing stored in `uploads/` and linked to project. | Project created and PDF file viewable. | **PASS** |
| **TC03** | **BOM Management** | Project Manager | Item Master Material Selection in BOM (Tamper Resistance) | Active Project exists | 1. Open BOM Creation form.<br/>2. Select material from Item Master dropdown (`Portland Cement 50kg`).<br/>3. Verify material code, unit, and cost auto-fill.<br/>4. Submit draft BOM v1.0. | Material details locked to Item Master. Draft BOM submitted for Director approval. | Auto-fill verified and draft saved cleanly. | **PASS** |
| **TC04** | **BOM Approval** | Director | Director BOM Approval & Semantic Version Bump | Draft/Pending BOM exists | 1. Log in as `director@elslanka.com`.<br/>2. Review pending BOM.<br/>3. Click "Approve".<br/>4. Edit approved BOM and resubmit for approval. | BOM status changes to 'Approved'. Version bumps semantically from `1.0` to `1.1` on revision. | Status updated to Approved and version bumped to `1.1`. | **PASS** |
| **TC05** | **Procurement (PR)** | Main Store Officer | Purchase Request Creation & Cumulative BOM Limit Blocking | Approved BOM exists (`BOM Cement limit: 500 bags`) | 1. Log in as `mainstore@elslanka.com`.<br/>2. Create PR #1 for 300 bags cement (Approved).<br/>3. Create PR #2 for 300 bags cement for same project. | PR #1 succeeds. PR #2 fails with HTTP 400 rejecting request as `300 + 300 > 500` allowed limit. | HTTP 400 returned with exact remaining limit message. | **PASS** |
| **TC06** | **Procurement (PO)** | Purchase Manager | Purchase Order Creation & Linkage to PR | Approved PR #1 exists | 1. Log in as `purchase@elslanka.com`.<br/>2. Click "Convert to PO" on PR #1.<br/>3. Select Supplier `Lanka Cement Ltd`.<br/>4. Set unit price and submit PO. | Purchase Order generated (`PO-2026-xxx`). Linked PR status set to 'PO Created'. | PO created and linked PR status updated. | **PASS** |
| **TC07** | **Inventory (GRN)** | Main Store Officer | Goods Received Note (GRN) Verification & Stock Ledger Balance Update | Sent/Delivered PO exists | 1. Log in as `mainstore@elslanka.com`.<br/>2. Open GRN form.<br/>3. Select PO and enter received quantities.<br/>4. Submit GRN. | GRN created (`GRN-2026-xxx`). Main Store stock incremented cleanly. Stock movement logged in ledger. | Stock balance updated and movement entry recorded. | **PASS** |
| **TC08** | **Site Transfer (MTN)** | Main Store & Site Store | Main Store to Site Store MTN Transfer with Rollback Check | Main Store has available stock | 1. Main Store issues MTN for 100 bags cement to Site Store.<br/>2. Verify Main Store stock decrements.<br/>3. Simulate database failure during site receipt. | Main Store stock decrements by 100. Site Store inventory increments upon verification. Transaction rolls back cleanly on error. | Stock movement and site inventory synced correctly. | **PASS** |
| **TC09** | **Site Inventory** | Site Store Officer | Site Material Usage Logging & BOM Variance Calculation | Site Store has received material | 1. Log in as `sitestore@elslanka.com`.<br/>2. Record material usage of 40 bags cement against Project.<br/>3. View Variance Report. | Usage deducted from Site Store stock. Variance report shows actual usage vs planned BOM consumption. | Usage recorded and variance calculated accurately. | **PASS** |
| **TC10** | **Payment Settlement** | Purchase Manager / Admin | Supplier Invoice Settlement via Stripe / Manual Cash / Cheque | Approved Invoice & PO exist | 1. Log in as `purchase@elslanka.com`.<br/>2. Click "Pay Now" on PO.<br/>3. Select "Cheque" payment option.<br/>4. Enter Cheque No (`CHQ-99120`), Bank, and Date.<br/>5. Submit payment. | Payment record created with status 'completed'. PO payment status set to 'paid'. Invoice status automatically updated to 'Paid'. | Payment created and invoice status marked 'Paid'. | **PASS** |

---

### Security & Operational Verification Matrix

- **Field-Level Encryption**: Encrypted fields in Site Store materials (`name`, `quantity`) operate deterministically in DB and decrypt seamlessly in authorized API responses.
- **Fail-Closed RBAC**: Gated API routes reject unauthenticated requests (HTTP 401) and unauthorized role access (HTTP 403).
- **Audit Logging**: Operational events (login, payment, status updates, stock movements) produce immutable records in the `AuditLog` collection.
