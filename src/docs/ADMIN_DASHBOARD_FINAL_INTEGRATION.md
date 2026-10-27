# N5 Admin Dashboard Final Integration Gate

This gate consolidates the existing two-operator Admin Panel modules into one navigation and API surface.

## Navigation
Overview → Users → KYC & Risk → Support → Games → Providers → Promotions → Rewards → VIP → Configuration

## Overview
Shows total users, active users, KYC review queue, open risk flags, open support tickets, active game sessions, and active admins.

## Operator model
Exactly two separate active admin accounts are supported. Every admin operation is authenticated, authorized, and audited. Shared credentials are not used. Financial ledger/balance manipulation and game-outcome manipulation are outside the admin UI.

## External boundary
Provider contracts/licenses, payment credentials, KYC vendor credentials, and production secrets remain operator/provider responsibilities. The Admin Panel does not invent or expose them.
