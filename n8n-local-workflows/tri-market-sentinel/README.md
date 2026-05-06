# trivectorlabs.ai

**trivectorlabs.ai** is a multi-market AI trading intelligence and execution automation system for crypto, stocks, and forex.

It is inspired by the public n8n template "AI Forex Trader using Claude/GPT, MT5 & News Sentiment Analysis", but expands the concept into a modular product:

- Crypto intelligence + execution
- Stocks intelligence + execution
- Forex/macro intelligence + MT5 execution
- Unified AI scoring
- Signal generation
- Risk gate
- Alerting, reporting, logging, and audit trail

## Core Flow

```text
SCAN NEWS & DATA
  -> AI ANALYSIS
  -> GENERATE SIGNAL
  -> RISK GATE
  -> EXECUTE TRADE
  -> CONFIRM + LOG + ALERT
```

## Workflows

### Market Collectors

- `TrivectorLabs.ai - Crypto Intel Collector`
- `TrivectorLabs.ai - Stocks Intel Collector`
- `TrivectorLabs.ai - Forex Macro Intel Collector`

Each collector normalizes raw news into the shared event contract and passes it to the scoring engine.

### Intelligence Layer

- `TrivectorLabs.ai - Unified Scoring Engine`
- `TrivectorLabs.ai - Signal & Risk Gate`

The scoring engine classifies sentiment, impact, confidence, and risk. The Signal & Risk Gate turns high-quality events into controlled trade proposals.

### Execution Layer

- `TrivectorLabs.ai - Crypto Execution`
- `TrivectorLabs.ai - Stocks Execution`
- `TrivectorLabs.ai - Forex MT5 Execution`

Execution is intentionally separated from intelligence. Each execution module supports paper mode first, risk limits, and trade confirmation logging.

### Output Layer

- `TrivectorLabs.ai - Alert Router`
- `TrivectorLabs.ai - Daily Intelligence Report`

Routes important events, trade proposals, execution confirmations, and daily briefs to Telegram, Discord, Google Sheets, or a future dashboard.

## Shared Event Contract

All collectors output:

```json
{
  "market": "crypto | stocks | forex",
  "asset": "BTC | ETH | NVDA | EURUSD | XAUUSD",
  "event_type": "regulation | earnings | macro | central_bank | hack | etf | geopolitical | technical | other",
  "headline": "string",
  "summary": "string",
  "source": "string",
  "url": "string",
  "published_at": "ISO datetime",
  "raw_text": "string"
}
```

The scoring engine returns:

```json
{
  "market": "crypto",
  "asset": "BTC",
  "bias": "bullish | bearish | neutral",
  "sentiment_score": -10,
  "impact_score": 0,
  "confidence": 0.0,
  "time_horizon": "intraday | 1-3 days | 1-2 weeks",
  "risk_flags": ["string"],
  "trade_recommendation": "watch_only | alert | avoid_trading",
  "reasoning": "string",
  "sources": ["url"]
}
```

The Signal & Risk Gate returns:

```json
{
  "execution_allowed": false,
  "execution_mode": "paper",
  "order": {
    "market": "crypto",
    "asset": "BTC",
    "side": "buy | sell | none",
    "order_type": "market | limit",
    "position_size_pct": 0.25,
    "stop_loss_required": true,
    "take_profit_required": true
  },
  "risk_gate": {
    "passed": false,
    "reasons": ["paper_mode_default", "confidence_below_threshold"]
  }
}
```

## Execution Safety

Live trading must remain disabled until explicitly configured and tested.

Required controls:

- paper mode first
- max trades per day
- max position size
- stop-loss and take-profit required
- news volatility lockout
- broker/exchange acknowledgement
- persistent trade log
- kill switch

## Required Credentials

- OpenAI or Anthropic
- NewsAPI or premium news provider
- Telegram bot token and chat ID, or Discord webhook
- Google Sheets or database
- Crypto exchange API: Binance, Bybit, or OKX
- Stocks broker API: Alpaca, Interactive Brokers, or Tradier
- Forex execution: MT5 Expert Advisor bridge

## Safety

This is market intelligence and automation infrastructure. It is not financial advice. Paper mode is the default. Live execution requires explicit broker/exchange setup, user approval, and risk controls.
