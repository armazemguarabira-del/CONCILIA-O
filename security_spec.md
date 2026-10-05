# Security Specification for Firestore Rules

## 1. Data Invariants
- **Identity & Authentication**: Writes to critical inventory records and reconciliations require authenticated access.
- **Admin Privileges**: The administrative user (`armazemguarabira@gmail.com`) or users with role ADMIN have elevated governance access.
- **Stock Positions**: Documents must have valid IDs (`isValidId`), bounded string lengths, and well-typed numeric fields.
- **Deviations (Quebras, Vales, Trocas, Faltas)**: Must reference valid deposit codes, have positive or non-negative quantities, and bounded text fields.
- **Frozen Reconciliations**: Historical frozen reconciliations represent official audit records and cannot be tampered with after creation by non-admins.
- **Profiles**: User profiles can be read by authenticated users for team and attribution purposes; administrative management is reserved for ADMIN users.

## 2. The Dirty Dozen Payloads (Rejection Vectors)
1. **Unauthenticated Write**: Anonymous/unauthenticated payload attempting write on `/stockPositions/01-347`. -> Expected: PERMISSION_DENIED.
2. **ID Poisoning Attack**: Document ID with invalid characters or excessive length (e.g., `../../etc` or 2000 chars) on `/stockPositions/{id}`. -> Expected: PERMISSION_DENIED.
3. **Shadow Field Injection**: Payload including malicious extra field `isHacked: true` on `/quebras/q1`. -> Expected: PERMISSION_DENIED.
4. **Negative Quantity**: Negative quantity payload `quantidade: -999` on `/quebras/q1`. -> Expected: PERMISSION_DENIED.
5. **Excessive String Payload / Denial of Wallet**: Description string exceeding maximum character boundary (`descricao` > 200 chars). -> Expected: PERMISSION_DENIED.
6. **Self-Escalation Attack**: Non-admin attempting to elevate profile role to `ADMIN` on `/users/{uid}`. -> Expected: PERMISSION_DENIED.
7. **Cross-Tenant / Invalid Deposito**: Write with invalid deposit code (e.g., `deposito: "999"` or malicious script). -> Expected: PERMISSION_DENIED.
8. **Tampering Frozen Audits**: Modifying historical frozen reconciliations without ADMIN permissions. -> Expected: PERMISSION_DENIED.
9. **Email Spoofing Attack**: Request claiming admin rights without verified email (`email_verified == false`). -> Expected: PERMISSION_DENIED.
10. **Type Mismatch in Metrics**: Passing string values for `valorTotal` or `prejuizoFinanceiro` on `/stockPositions/{id}`. -> Expected: PERMISSION_DENIED.
11. **Malicious Vale Invariant**: Vale write without required team / motorista attribution. -> Expected: PERMISSION_DENIED.
12. **Blanket Query Scraping**: Attempting arbitrary collection queries without authentication. -> Expected: PERMISSION_DENIED.
