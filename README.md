# Fintech Wallet, Orders & Withdrawal Processing System

A backend fintech POC for managing:

- User authentication
- JWT access tokens
- Refresh tokens
- Device/session tracking
- Rate limiting
- Wallet balances
- Available and locked wallet balances
- Immutable wallet ledger
- Wallet top-ups
- Orders and order payments
- Withdrawals
- Withdrawal reservation/release/processing
- Redis
- BullMQ background processing
- MySQL
- Prisma ORM
- Docker and Docker Compose

The project is designed with a strong focus on:

- Transaction safety
- Idempotency
- Auditability
- Concurrent wallet operations
- Background processing
- Preventing negative wallet balances

---

# Architecture

```text
                         ┌──────────────────────┐
                         │       Client         │
                         │ Postman / Frontend   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Express API      │
                         │       Port 3000       │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
          │    Auth     │    │   Wallet    │    │    Orders   │
          │   Module    │    │   Module    │    │   Module    │
          └─────────────┘    └─────────────┘    └─────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │   Withdrawal    │
                           │     Module      │
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │     BullMQ      │
                           │  Withdrawal Job │
                           └────────┬────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │     Worker      │
                           │ fintech-worker  │
                           └─────────────────┘

                 ┌─────────────────┐
                 │      MySQL      │
                 │ fintech_wallet  │
                 └─────────────────┘

                 ┌─────────────────┐
                 │      Redis      │
                 │     BullMQ      │
                 └─────────────────┘