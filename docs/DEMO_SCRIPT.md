# Dokan AI – Demo script (about 7 minutes)

Say first: **payments are a sandbox, no real money moves.**

## Before you start (do this the day before)
- Three accounts, already created and logged in on three browser profiles:
  customer `____`, seller `____` (owns a **verified** shop), admin `____`.
- At least 6 in-stock products with photos, across 2 categories, with sizes and stock.
- One extra delivered order (for the complaint step) and one order still in escrow (for the refund step).
- `DISABLE_DEV_USER_HEADER=true` is set, and a short screen recording of the full path is saved as a backup.

## The path
| Min | Who | Say and do |
| --- | --- | --- |
| 0:00 | – | Problem: small sellers run on chat inboxes; buyers can't trust them. Dokan AI adds an AI stylist, escrow and verified complaints. |
| 0:45 | Customer | Home page: real product and shop counts, top sellers, platform reviews. Open **Shop**, use a filter. |
| 1:30 | Customer | **AI Stylist**: occasion, who it's for, budget. Show the bundle, click **Add bundle to cart**. |
| 2:30 | Customer | **Cart** → checkout with bKash. Point at the sandbox banner. Order is paid, money is held in escrow. |
| 3:15 | Seller | **Seller Hub → Orders**: accept, pack, ship. Show **Analytics** and **Premium** (buy 1 month in the sandbox). |
| 4:15 | Customer | **Orders**: confirm delivery. |
| 4:45 | Seller / Admin | **Earnings** and admin **Ledger**: the order shows as released. Download the CSV. |
| 5:15 | Customer → Seller → Admin | **Report a problem** on the second order. Seller responds. Admin opens it and decides with a written note. Customer sees the decision. |
| 6:15 | Admin | **Refunds**: refund the order that is still in escrow. Press **Release due payouts**. Show **Reviews**: approve one. |
| 6:45 | – | Close: what is built, what is next. |

## Be honest about future work
Product reviews, chat, wishlist, vouchers, notifications, real payment gateways, courier tracking, saved addresses, partial refunds, scheduled automatic payouts, admin two-factor login.

## If something fails
Don't debug live. Say "this is the sandbox" and switch to the backup recording.
