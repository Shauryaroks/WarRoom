"""Tests for trading service: atomic buy/sell with 30% cap enforcement."""

import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models import (
    CashLedger,
    StockHolding,
    Team,
    TeamStatus,
    Transaction,
    TransactionType,
)


def _make_team(
    *,
    team_id: uuid.UUID | None = None,
    name: str = "TestTeam",
    ticker: str = "TST",
    cash: Decimal = Decimal("1000000"),
    stock_price: Decimal = Decimal("100"),
    shares_outstanding: int = 1000000,
    public_float: int = 100000,
) -> MagicMock:
    """Create a mock Team object for testing (no DB)."""
    team = MagicMock(spec=Team)
    team.id = team_id or uuid.uuid4()
    team.name = name
    team.ticker = ticker
    team.cash = cash
    team.stock_price = stock_price
    team.shares_outstanding = shares_outstanding
    team.public_float = public_float
    team.status = TeamStatus.ACTIVE
    team.treasury_shares = shares_outstanding - public_float
    return team


def _make_holding(
    *,
    owner_team_id: uuid.UUID,
    target_team_id: uuid.UUID,
    shares_owned: int = 0,
    total_cost_basis: Decimal = Decimal("0"),
) -> MagicMock:
    """Create a mock StockHolding object for testing (no DB)."""
    holding = MagicMock(spec=StockHolding)
    holding.id = uuid.uuid4()
    holding.owner_team_id = owner_team_id
    holding.target_team_id = target_team_id
    holding.shares_owned = shares_owned
    holding.total_cost_basis = total_cost_basis
    return holding


class MockScalarResult:
    """Mock for db.execute().scalars().all()"""

    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class MockResult:
    """Mock for db.execute() result."""

    def __init__(self, items):
        self._items = items

    def scalars(self):
        return MockScalarResult(self._items)

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


# ---- Test: execute_buy creates StockHolding, Transaction, CashLedger, deducts cash ----


@pytest.mark.asyncio
async def test_execute_buy_creates_records():
    """execute_buy should create StockHolding, Transaction, CashLedger and deduct cash."""
    from app.services.trading_service import execute_buy

    buyer = _make_team(ticker="BUY", cash=Decimal("100000"))
    target = _make_team(ticker="TGT", stock_price=Decimal("50"), public_float=100000)

    db = AsyncMock()
    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

    # scalar calls: 1st = target team, 2nd = buyer team
    # execute calls: holdings query
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        elif call_count == 2:
            return buyer
        return None

    async def mock_execute(stmt):
        return MockResult([])  # No existing holdings

    db.scalar = mock_scalar
    db.execute = mock_execute

    txn = await execute_buy(db, buyer.id, target.id, 100)

    assert isinstance(txn, Transaction)
    assert txn.shares == 100
    assert txn.price_per_share == Decimal("50")
    assert txn.total_value == Decimal("5000")
    assert txn.transaction_type == TransactionType.BUY
    # Cash should be deducted
    assert buyer.cash == Decimal("95000")
    # Should have added StockHolding, Transaction, CashLedger
    types_added = {type(obj).__name__ for obj in added_objects}
    assert "StockHolding" in types_added
    assert "Transaction" in types_added
    assert "CashLedger" in types_added


# ---- Test: execute_buy rejects self-trading ----


@pytest.mark.asyncio
async def test_execute_buy_rejects_self_trading():
    """execute_buy should raise ValueError when buyer_team_id == target_team_id."""
    from app.services.trading_service import execute_buy

    team_id = uuid.uuid4()
    db = AsyncMock()

    with pytest.raises(ValueError, match="own stock"):
        await execute_buy(db, team_id, team_id, 100)


# ---- Test: execute_buy rejects when exceeding 30% cap ----


@pytest.mark.asyncio
async def test_execute_buy_rejects_exceeding_30pct_cap():
    """execute_buy should raise ValueError when shares would exceed 30% of public_float."""
    from app.services.trading_service import execute_buy

    buyer = _make_team(ticker="BUY", cash=Decimal("10000000"))
    target = _make_team(ticker="TGT", stock_price=Decimal("10"), public_float=100000)
    # 30% of 100000 = 30000. Existing holdings = 29000. Buying 2000 would exceed.
    existing_holding = _make_holding(
        owner_team_id=uuid.uuid4(),
        target_team_id=target.id,
        shares_owned=29000,
    )

    db = AsyncMock()
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        return buyer

    async def mock_execute(stmt):
        return MockResult([existing_holding])

    db.scalar = mock_scalar
    db.execute = mock_execute

    with pytest.raises(ValueError, match="30%"):
        await execute_buy(db, buyer.id, target.id, 2000)


# ---- Test: execute_buy rejects insufficient cash ----


@pytest.mark.asyncio
async def test_execute_buy_rejects_insufficient_cash():
    """execute_buy should raise ValueError when buyer has insufficient cash."""
    from app.services.trading_service import execute_buy

    buyer = _make_team(ticker="BUY", cash=Decimal("100"))  # Only $100
    target = _make_team(ticker="TGT", stock_price=Decimal("50"), public_float=100000)

    db = AsyncMock()
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        return buyer

    async def mock_execute(stmt):
        return MockResult([])

    db.scalar = mock_scalar
    db.execute = mock_execute

    with pytest.raises(ValueError, match="[Ii]nsufficient cash"):
        await execute_buy(db, buyer.id, target.id, 10)  # Would cost $500


# ---- Test: execute_sell reduces shares and adds cash ----


@pytest.mark.asyncio
async def test_execute_sell_reduces_shares_adds_cash():
    """execute_sell should reduce shares_owned, add cash, adjust cost basis."""
    from app.services.trading_service import execute_sell

    seller = _make_team(ticker="SEL", cash=Decimal("50000"))
    target = _make_team(ticker="TGT", stock_price=Decimal("200"), public_float=100000)
    holding = _make_holding(
        owner_team_id=seller.id,
        target_team_id=target.id,
        shares_owned=500,
        total_cost_basis=Decimal("50000"),  # avg $100/share
    )

    db = AsyncMock()
    added_objects = []
    db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        elif call_count == 2:
            return holding
        elif call_count == 3:
            return seller
        return None

    db.scalar = mock_scalar

    txn = await execute_sell(db, seller.id, target.id, 200)

    assert isinstance(txn, Transaction)
    assert txn.shares == 200
    assert txn.price_per_share == Decimal("200")
    assert txn.total_value == Decimal("40000")
    assert txn.transaction_type == TransactionType.SELL
    # Shares reduced
    assert holding.shares_owned == 300
    # Cash increased
    assert seller.cash == Decimal("90000")
    # Cost basis adjusted proportionally: 50000 * (300/500) = 30000
    assert holding.total_cost_basis == Decimal("30000")


# ---- Test: execute_sell rejects when not enough shares ----


@pytest.mark.asyncio
async def test_execute_sell_rejects_insufficient_shares():
    """execute_sell should raise ValueError when team doesn't own enough shares."""
    from app.services.trading_service import execute_sell

    seller = _make_team(ticker="SEL")
    target = _make_team(ticker="TGT", stock_price=Decimal("100"), public_float=100000)
    holding = _make_holding(
        owner_team_id=seller.id,
        target_team_id=target.id,
        shares_owned=50,
    )

    db = AsyncMock()
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        elif call_count == 2:
            return holding
        return None

    db.scalar = mock_scalar

    with pytest.raises(ValueError, match="[Ii]nsufficient shares"):
        await execute_sell(db, seller.id, target.id, 100)


# ---- Test: preview_trade returns cost preview without modifying data ----


@pytest.mark.asyncio
async def test_preview_trade_returns_preview():
    """preview_trade should return cost preview without modifying any data."""
    from app.services.trading_service import preview_trade

    buyer = _make_team(ticker="BUY", cash=Decimal("100000"))
    target = _make_team(ticker="TGT", stock_price=Decimal("50"), public_float=100000)

    db = AsyncMock()
    call_count = 0

    async def mock_scalar(stmt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return target
        elif call_count == 2:
            return buyer
        return None

    async def mock_execute(stmt):
        return MockResult([])

    db.scalar = mock_scalar
    db.execute = mock_execute

    result = await preview_trade(db, buyer.id, target.id, 100, "BUY")

    assert result["target_ticker"] == "TGT"
    assert result["shares"] == 100
    assert result["price_per_share"] == "50.00"
    assert result["total_cost"] == "5000.00"
    assert result["available_cash"] == "100000.00"
    # 30% of 100000 = 30000. No existing holdings. Available = 30000.
    assert result["shares_available"] == 30000
    assert result["current_holding"] == 0
    # Verify data not modified
    assert buyer.cash == Decimal("100000")


# ---- Test: get_portfolio returns holdings with P&L ----


@pytest.mark.asyncio
async def test_get_portfolio_returns_holdings_with_pnl():
    """get_portfolio should return holdings with P&L calculated from cost basis vs current price."""
    from app.services.trading_service import get_portfolio

    team = _make_team(ticker="OWN", cash=Decimal("50000"))
    target = _make_team(
        ticker="TGT",
        stock_price=Decimal("150"),
        public_float=100000,
        shares_outstanding=1000000,
    )
    holding = _make_holding(
        owner_team_id=team.id,
        target_team_id=target.id,
        shares_owned=200,
        total_cost_basis=Decimal("20000"),  # avg $100/share
    )
    # Attach target_team relationship manually for the test
    holding.target_team = target

    db = AsyncMock()

    async def mock_scalar(stmt):
        return team

    async def mock_execute(stmt):
        return MockResult([holding])

    db.scalar = mock_scalar
    db.execute = mock_execute

    result = await get_portfolio(db, team.id)

    assert result["cash"] == "50000.00"
    assert len(result["holdings"]) == 1

    h = result["holdings"][0]
    assert h["ticker"] == "TGT"
    assert h["shares_owned"] == 200
    assert h["avg_buy_price"] == "100.00"
    assert h["current_price"] == "150.00"
    assert h["market_value"] == "30000.00"
    assert h["pnl"] == "10000.00"
    # pnl_pct = (10000/20000) * 100 = 50%
    assert h["pnl_pct"] == "50.00"

    # Net worth = cash + holdings value
    assert result["total_holdings_value"] == "30000.00"
    assert result["net_worth"] == "80000.00"
