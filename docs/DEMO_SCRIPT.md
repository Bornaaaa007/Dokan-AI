# Dokan AI – Demo script (about 8 minutes)

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
| 2:00 | Seller → Customer | **Forwarded message updates a price.** Seller Hub → **Update from a chat message**: paste `Maroon katan sari now 2400, sizes M and L only, 3 left`. Show the preview (old → new), press **Confirm**, then **Undo** once to show it is reversible. Say honestly: the seller copies the message text in; direct Messenger needs a Meta app review. Then ask the Stylist again and show the look uses the new price. |
| 2:20 | Customer | **Honest "too low" answer.** In the Stylist press the **800** budget (or type 800). It says the cheapest complete look in the shop is X BDT and shows only real single items that fit. Nothing is padded or faked. Optional: a shop with no shoes shows "Not in stock right now: Shoes" and a partial look with its true total. |
| 2:30 | Customer | **Cart** → checkout with bKash. Point at the sandbox banner. Order is paid, money is held in escrow. |
| 3:15 | Seller | **Seller Hub → Orders**: accept, pack, ship. Show **Analytics** and **Premium** (buy 1 month in the sandbox). |
| 4:15 | Customer | **Orders**: confirm delivery. |
| 4:45 | Seller / Admin | **Earnings** and admin **Ledger**: the order shows as released. Download the CSV. |
| 5:15 | Customer → Seller → Admin | **Report a problem** on the second order. Seller responds. Admin opens it and decides with a written note. Customer sees the decision. |
| 6:15 | Admin | **Refunds**: refund the order that is still in escrow. Press **Release due payouts**. Show **Reviews**: approve one. |
| 6:45 | – | Close: what is built, what is next. |

## Items that vanish (optional 20 seconds)
Open a look in the Stylist, then in the seller window set one of its items to stock 0. Press **Add bundle to cart**: the Stylist says the item sold out and offers a replacement from the same slot inside the budget (or says none fits and offers **Rebuild my look**). Nothing is added until the customer reviews the updated look. Checkout also refuses gone items with a clear message and charges nothing.

## Be honest about future work
Chat, wishlist, vouchers, notifications, real payment gateways, courier tracking, saved addresses, partial refunds, scheduled automatic payouts, admin two-factor login.

## If something fails
Don't debug live. Say "this is the sandbox" and switch to the backup recording.
