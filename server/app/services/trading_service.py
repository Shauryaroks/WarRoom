"""Trading service with atomic buy/sell operations using SELECT FOR UPDATE.

Enforces 30% external shareholding cap, self-trade prevention,
and cash sufficiency checks within a single DB transaction.
Caller is responsible for committing the transaction.
"""

import uuid
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CashLedger,
    StockHolding,
    Team,
    Transaction,
    TransactionType,
)


async def preview_trade(
    db: AsyncSession,
    buyer_team_id: uuid.UUID,
    target_team_id: uuid.UUID,
    shares: int,
    trade_type: str,
) -> dict:
    """Preview a trade without executing. No locks needed (read-only per D-06).

    Returns cost/proceeds preview with available shares before 30% cap.
    """
    if buyer_team_id == target_team_id:
        raise ValueError("Cannot trade your own stock")

    if shares <= 0:
        raise ValueError("Shares must be positive")

    # Get target team for price info
    target = await db.scalar(
        select(Team).where(Team.id == target_team_id)
    )
    if not target:
        raise ValueError("Target team not found")

    # Get buyer team for cash info
    buyer = await db.scalar(
        select(Team).where(Team.id == buyer_team_id)
    )
    if not buyer:
        raise ValueError("Buyer team not found")

    # Calculate total external holdings for the target
    holdings_result = await db.execute(
        select(StockHolding).where(StockHolding.target_team_id == target_team_id)
    )
    all_holdings = holdings_result.scalars().all()
    total_external = sum(h.shares_owned for h in all_holdings)
    max_external = int(target.public_float * Decimal("0.30"))
    shares_available = max_external - total_external

    # Get buyer's current holding in this target
    buyer_holding = next(
        (h for h in all_holdings if h.owner_team_id == buyer_team_id), None
    )
    current_holding = buyer_holding.shares_owned if buyer_holding else 0

    total_cost = target.stock_price * shares

    return {
        "target_ticker": target.ticker,
        "shares": shares,
        "price_per_share": str(target.stock_price.quantize(Decimal("0.01"))),
        "total_cost": str(total_cost.quantize(Decimal("0.01"))),
        "available_cash": str(buyer.cash.quantize(Decimal("0.01"))),
        "shares_available": shares_available,
        "current_holding": current_holding,
    }


async def execute_buy(
    db: AsyncSession,
    buyer_team_id: uuid.UUID,
    target_team_id: uuid.UUID,
    shares: int,
) -> Transaction:
    """Execute a buy order with atomic 30% cap enforcement.

    Uses SELECT FOR UPDATE on target team, all holdings for target, and buyer team
    to prevent concurrent trades from exceeding the cap (D-08).

    Caller must commit the transaction. Do NOT publish Redis messages inside
    this function (anti-pattern from RESEARCH).
    """
    # Validate self-trade
    if buyer_team_id == target_team_id:
        raise ValueError("Cannot trade your own stock")

    if shares <= 0:
        raise ValueError("Shares must be positive")

    # 1. Lock target team row -> get stock_price, public_float
    target = await db.scalar(
        select(Team)
        .where(Team.id == target_team_id)
        .with_for_update()
    )
    if not target:
        raise ValueError("Target team not found")

    # 2. Lock ALL holdings for this target -> sum total external ownership
    holdings_result = await db.execute(
        select(StockHolding)
        .where(StockHolding.target_team_id == target_team_id)
        .with_for_update()
    )
    all_holdings = holdings_result.scalars().all()
    total_external = sum(h.shares_owned for h in all_holdings)
    max_external = int(target.public_float * Decimal("0.30"))

    if total_external + shares > max_external:
        available = max_external - total_external
        raise ValueError(
            f"Would exceed 30% cap. Available: {available} shares"
        )

    # 3. Lock buyer team -> check cash
    buyer = await db.scalar(
        select(Team)
        .where(Team.id == buyer_team_id)
        .with_for_update()
    )
    if not buyer:
        raise ValueError("Buyer team not found")

    total_cost = target.stock_price * shares
    if buyer.cash < total_cost:
        raise ValueError(
            f"Insufficient cash. Need: {total_cost}, Have: {buyer.cash}"
        )

    # 4. Execute trade
    # Deduct cash
    buyer.cash -= total_cost

    # Create or update StockHolding
    buyer_holding = next(
        (h for h in all_holdings if h.owner_team_id == buyer_team_id), None
    )
    if buyer_holding:
        buyer_holding.shares_owned += shares
        buyer_holding.total_cost_basis += total_cost
    else:
        buyer_holding = StockHolding(
            owner_team_id=buyer_team_id,
            target_team_id=target_team_id,
            shares_owned=shares,
            total_cost_basis=total_cost,
        )
        db.add(buyer_holding)

    # Create Transaction
    txn = Transaction(
        buyer_team_id=buyer_team_id,
        target_team_id=target_team_id,
        shares=shares,
        price_per_share=target.stock_price,
        total_value=total_cost,
        transaction_type=TransactionType.BUY,
    )
    db.add(txn)

    # Create CashLedger entry
    ledger = CashLedger(
        team_id=buyer_team_id,
        entry_type="TRADE_BUY",
        amount=-total_cost,
        balance_after=buyer.cash,
        reference_type="transaction",
        description=f"Bought {shares} shares of {target.ticker} at {target.stock_price}",
    )
    db.add(ledger)

    return txn


async def execute_sell(
    db: AsyncSession,
    seller_team_id: uuid.UUID,
    target_team_id: uuid.UUID,
    shares: int,
) -> Transaction:
    """Execute a sell order. Locks target team, holding, and seller team rows.

    Adjusts cost basis proportionally on partial sell.
    Deletes holding if shares become 0.
    Caller must commit the transaction.
    """
    # Validate self-trade
    if seller_team_id == target_team_id:
        raise ValueError("Cannot trade your own stock")

    if shares <= 0:
        raise ValueError("Shares must be positive")

    # 1. Lock target team -> get stock_price
    target = await db.scalar(
        select(Team)
        .where(Team.id == target_team_id)
        .with_for_update()
    )
    if not target:
        raise ValueError("Target team not found")

    # 2. Lock seller's holding for this target -> check shares_owned
    holding = await db.scalar(
        select(StockHolding)
        .where(
            StockHolding.owner_team_id == seller_team_id,
            StockHolding.target_team_id == target_team_id,
        )
        .with_for_update()
    )
    if not holding or holding.shares_owned < shares:
        owned = holding.shares_owned if holding else 0
        raise ValueError(
            f"Insufficient shares. Own: {owned}, Selling: {shares}"
        )

    # 3. Lock seller team -> add cash
    seller = await db.scalar(
        select(Team)
        .where(Team.id == seller_team_id)
        .with_for_update()
    )
    if not seller:
        raise ValueError("Seller team not found")

    # 4. Execute trade
    proceeds = target.stock_price * shares

    # Adjust cost basis proportionally
    original_shares = holding.shares_owned
    remaining_shares = original_shares - shares
    if remaining_shares > 0:
        holding.total_cost_basis = (
            holding.total_cost_basis
            * Decimal(remaining_shares)
            / Decimal(original_shares)
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        holding.shares_owned = remaining_shares
    else:
        # Sold all shares -- delete the holding
        holding.shares_owned = 0
        holding.total_cost_basis = Decimal("0")
        await db.delete(holding)

    # Add cash to seller
    seller.cash += proceeds

    # Create Transaction
    txn = Transaction(
        seller_team_id=seller_team_id,
        target_team_id=target_team_id,
        shares=shares,
        price_per_share=target.stock_price,
        total_value=proceeds,
        transaction_type=TransactionType.SELL,
    )
    db.add(txn)

    # Create CashLedger entry
    ledger = CashLedger(
        team_id=seller_team_id,
        entry_type="TRADE_SELL",
        amount=proceeds,
        balance_after=seller.cash,
        reference_type="transaction",
        description=f"Sold {shares} shares of {target.ticker} at {target.stock_price}",
    )
    db.add(ledger)

    return txn


async def get_portfolio(db: AsyncSession, team_id: uuid.UUID) -> dict:
    """Get team's portfolio with holdings, P&L, and net worth.

    Returns all values as strings (Decimal precision per RESEARCH Pitfall 5).
    """
    # Get team for cash balance
    team = await db.scalar(
        select(Team).where(Team.id == team_id)
    )
    if not team:
        raise ValueError("Team not found")

    # Get all holdings with target team eagerly loaded
    from sqlalchemy.orm import joinedload
    holdings_result = await db.execute(
        select(StockHolding)
        .options(joinedload(StockHolding.target_team))
        .where(StockHolding.owner_team_id == team_id)
    )
    holdings = holdings_result.scalars().unique().all()

    holdings_data = []
    total_holdings_value = Decimal("0")

    for h in holdings:
        target = h.target_team
        if not target:
            continue

        market_value = target.stock_price * h.shares_owned
        avg_buy_price = (
            (h.total_cost_basis / h.shares_owned).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if h.shares_owned > 0
            else Decimal("0")
        )
        pnl = market_value - h.total_cost_basis
        pnl_pct = (
            ((pnl / h.total_cost_basis) * 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if h.total_cost_basis > 0
            else Decimal("0")
        )
        ownership_pct = (
            (Decimal(h.shares_owned) / Decimal(target.public_float) * 100).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            if target.public_float > 0
            else Decimal("0")
        )

        total_holdings_value += market_value

        holdings_data.append({
            "target_team_id": str(h.target_team_id),
            "ticker": target.ticker,
            "shares_owned": h.shares_owned,
            "avg_buy_price": str(avg_buy_price),
            "current_price": str(target.stock_price.quantize(Decimal("0.01"))),
            "market_value": str(market_value.quantize(Decimal("0.01"))),
            "pnl": str(pnl.quantize(Decimal("0.01"))),
            "pnl_pct": str(pnl_pct),
            "ownership_pct": str(ownership_pct),
        })

    net_worth = team.cash + total_holdings_value

    return {
        "cash": str(team.cash.quantize(Decimal("0.01"))),
        "holdings": holdings_data,
        "total_holdings_value": str(total_holdings_value.quantize(Decimal("0.01"))),
        "net_worth": str(net_worth.quantize(Decimal("0.01"))),
    }
