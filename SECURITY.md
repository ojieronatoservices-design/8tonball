# 8TONBALL Security Strategy

This document outlines the security architecture and measures implemented to protect the 8TONBALL application, its users, and financial transactions.

## 1. Authentication & Identity
**Provider**: [Clerk](https://clerk.com)
- **Mechanism**: We use Clerk for robust, industry-standard authentication.
- **MFA**: Multi-Factor Authentication is supported and recommended for Admin accounts.
- **Session Management**: Secure, short-lived sessions are managed entirely by Clerk's infrastructure.
- **Social Login**: OAuth providers (Google, Apple, X, Facebook) allow users to authenticate without creating new passwords, reducing credential reuse risks.

## 2. Authorization & data Access
**Mechanism**: Row Level Security (RLS) with Supabase + Clerk JWTs.
- **Zero Trust**: The database assumes no trust. Every query is verified against the user's authenticated Clerk identity.
- **JWT Injection**: A custom `useSupabase` hook injects the Clerk session token `Authorization: Bearer <token>` into every request.
- **Policy Enforcement**: 
    - Supabase extracts the `sub` (User ID) from the Clerk JWT.
    - RLS policies restrict users to reading/writing only their *own* data (e.g., `user_id = auth_uid_text()`).
    - Public data (Raffles) is read-only for unauthenticated users.

## 3. Financial Integrity
**Mechanism**: Atomic Database Transactions (RPC)
- **No Client-Side Logic**: Critical operations like "Entering a Raffle" or "Approving a Payment" are **never** calculated on the client.
- **Stored Procedures**: We use PostgreSQL Functions (RPCs) to handle balance updates. This ensures *Atomicity*—either the entire transaction succeeds (Entry created AND Balance deducted), or it fails completely. This prevents race conditions and "double spending."

## 4. Fraud Prevention
**Mechanism**: Human-in-the-Loop Verification.
- **Manual Review**: Use of automated payment gateways is currently bypassed in favor of manual proof-of-payment uploads.
- **Admin Approval**: Tibs (in-app currency) are only minted when an Admin explicitly approves a transaction after verifying the receipt.
- **Immutable Audit**: All transaction attempts (approved or rejected) are permanently recorded in the `transactions` table.

## 5. Storage Security
**Mechanism**: Supabase Storage Policies.
- **Public Read, Authenticated Write**: Anyone can view raffle assets, but payment proofs are logically restricted to the user and Admins.
- **Path Isolation**: Users upload proofs to `proofs/<user_id>-<timestamp>`, ensuring they cannot overwrite others' files.

## 6. Privacy & Data Protection
- **Email Privacy**: User email addresses are stored only in the `profiles` table, protected by RLS. They are never logged in plaintext in public-facing or client-side logs.
- **Bank Info Masking**: QR codes and bank details in the UI are partially masked (e.g., `•••••••• 2142`) to protect the platform owner's private accounts while still allowing payment verification.
- **Consumable Currency**: Tibs are strictly platform credits. There is no automated "Withdraw" or "Refund to Cash" logic, ensuring the financial flow remains internal and non-reversible once consumed.

## 7. Infrastructure Safety
- **Environment Variables**: Sensitive keys (Supabase Service Role, Resend API key) are stored as Vercel Secrets and are never committed to the repository (gitignored).
- **Public vs Private**: Schema logic is public for transparency, but data access is locked behind Clerk-verified session tokens.
