import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const outDir = dirname(fileURLToPath(import.meta.url));

function id() {
  return randomUUID();
}

function workflow({ workflowId, name, nodes, connections }) {
  return [
    {
      id: workflowId,
      name,
      description: null,
      active: false,
      isArchived: false,
      nodes,
      connections,
      settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
      },
      staticData: null,
      meta: null,
      pinData: {},
      tags: [],
      versionMetadata: {
        name: null,
        description: null,
      },
    },
  ];
}

function sticky(name, content, position, size = [520, 280], color = 4) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position,
    parameters: {
      color,
      width: size[0],
      height: size[1],
      content,
    },
  };
}

function schedule(name, position, interval = 30) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position,
    parameters: {
      rule: {
        interval: [
          {
            field: 'minutes',
            minutesInterval: interval,
          },
        ],
      },
    },
  };
}

function manual(name, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position,
    parameters: {},
  };
}

function httpGet(name, url, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    parameters: {
      url,
      method: 'GET',
      options: {},
    },
  };
}

function code(name, jsCode, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: {
      jsCode,
    },
  };
}

function executeWorkflow(name, workflowId, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position,
    parameters: {
      workflowId: {
        __rl: true,
        mode: 'id',
        value: workflowId,
      },
      options: {},
    },
  };
}

function executeWorkflowTrigger(name, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.1,
    position,
    parameters: {
      inputSource: 'passthrough',
    },
  };
}

function webhook(name, path, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2.1,
    position,
    parameters: {
      httpMethod: 'POST',
      path,
      responseMode: 'responseNode',
      options: {},
    },
  };
}

function respond(name, position) {
  return {
    id: id(),
    name,
    type: 'n8n-nodes-base.respondToWebhook',
    typeVersion: 1.4,
    position,
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json }}',
      options: {},
    },
  };
}

function openAiModel(name, position) {
  return {
    id: id(),
    name,
    type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    typeVersion: 1.2,
    position,
    parameters: {
      model: {
        __rl: true,
        mode: 'list',
        value: 'gpt-4o-mini',
      },
      options: {
        temperature: 0.2,
      },
    },
  };
}

function collectorCode({ market, assets, eventTypes }) {
  return `const market = ${JSON.stringify(market)};
const watchedAssets = ${JSON.stringify(assets)};
const eventTypes = ${JSON.stringify(eventTypes)};

function normalizeItem(item, sourceName) {
  const headline = item.title ?? item.headline ?? item.name ?? '';
  const rawText = [headline, item.description, item.summary, item.content].filter(Boolean).join('\\n');
  const lower = rawText.toLowerCase();
  const matchedAssets = watchedAssets.filter((asset) => {
    const aliases = asset.aliases ?? [asset.symbol];
    return aliases.some((alias) => lower.includes(alias.toLowerCase()));
  });
  const matchedEvent = eventTypes.find((event) => event.keywords.some((keyword) => lower.includes(keyword)));

  return (matchedAssets.length ? matchedAssets : [{ symbol: 'MARKET' }]).map((asset) => ({
    market,
    asset: asset.symbol,
    event_type: matchedEvent?.type ?? 'other',
    headline,
    summary: item.description ?? item.summary ?? '',
    source: sourceName,
    url: item.url ?? item.link ?? '',
    published_at: item.publishedAt ?? item.pubDate ?? item.isoDate ?? new Date().toISOString(),
    raw_text: rawText,
  }));
}

const items = $input.all();
const output = [];
for (const item of items) {
  const json = item.json;
  const sourceName = json.sourceName ?? json.source?.name ?? json.feed ?? 'configured_source';
  if (Array.isArray(json.articles)) {
    for (const article of json.articles) output.push(...normalizeItem(article, sourceName));
  } else if (Array.isArray(json.items)) {
    for (const feedItem of json.items) output.push(...normalizeItem(feedItem, sourceName));
  } else {
    output.push(...normalizeItem(json, sourceName));
  }
}

return output.map((event) => ({ json: event }));`;
}

function scoringCodePrompt() {
  return `const events = $input.all().map((item) => item.json);
return events.map((event) => ({
  json: {
    ...event,
    scoring_prompt: \`You are trivectorlabs.ai, a multi-market AI trading intelligence analyst.

Analyze this market event and return STRICT JSON only.

Event:
\${JSON.stringify(event, null, 2)}

Return this schema:
{
  "market": "crypto|stocks|forex",
  "asset": "symbol",
  "bias": "bullish|bearish|neutral",
  "sentiment_score": number from -10 to 10,
  "impact_score": number from 0 to 100,
  "confidence": number from 0 to 1,
  "time_horizon": "intraday|1-3 days|1-2 weeks",
  "risk_flags": ["short strings"],
  "trade_recommendation": "watch_only|alert|avoid_trading",
  "reasoning": "brief explanation",
  "sources": ["url"]
}

Rules:
- This is market intelligence, not financial advice.
- Prefer "watch_only" unless impact and confidence are both high.
- Use "avoid_trading" when the event implies unclear, headline-driven, or extreme volatility.
- Mention cross-market effects when relevant: DXY, rates, gold, equities, BTC risk appetite.
- Do not invent unavailable facts.\`
  }
}));`;
}

function signalRiskGateCode() {
  return `const MAX_POSITION_SIZE_PCT = Number($env.TRIVECTOR_MAX_POSITION_SIZE_PCT ?? 0.25);
const MIN_IMPACT = Number($env.TRIVECTOR_MIN_EXECUTION_IMPACT ?? 75);
const MIN_CONFIDENCE = Number($env.TRIVECTOR_MIN_EXECUTION_CONFIDENCE ?? 0.65);
const PAPER_MODE = String($env.TRIVECTOR_EXECUTION_MODE ?? 'paper').toLowerCase() !== 'live';
const KILL_SWITCH = String($env.TRIVECTOR_KILL_SWITCH ?? 'on').toLowerCase() === 'on';

function sideFromBias(bias) {
  if (bias === 'bullish') return 'buy';
  if (bias === 'bearish') return 'sell';
  return 'none';
}

return $input.all().map((item) => {
  const event = item.json;
  const reasons = [];
  const side = sideFromBias(event.bias);
  const impactOk = Number(event.impact_score ?? 0) >= MIN_IMPACT;
  const confidenceOk = Number(event.confidence ?? 0) >= MIN_CONFIDENCE;
  const actionableBias = side !== 'none';
  const avoidTrading = event.trade_recommendation === 'avoid_trading';

  if (PAPER_MODE) reasons.push('paper_mode_default');
  if (KILL_SWITCH) reasons.push('kill_switch_on');
  if (!impactOk) reasons.push('impact_below_threshold');
  if (!confidenceOk) reasons.push('confidence_below_threshold');
  if (!actionableBias) reasons.push('neutral_bias');
  if (avoidTrading) reasons.push('avoid_trading_recommendation');
  if (event.risk_flags?.some((flag) => /extreme|unclear|parse_failed|headline/i.test(flag))) {
    reasons.push('risk_flag_lockout');
  }

  const passed = reasons.every((reason) => reason === 'paper_mode_default') && impactOk && confidenceOk && actionableBias && !avoidTrading;
  const executionAllowed = passed || (PAPER_MODE && impactOk && confidenceOk && actionableBias && !avoidTrading);

  return {
    json: {
      ...event,
      execution_allowed: executionAllowed,
      execution_mode: PAPER_MODE ? 'paper' : 'live',
      order: {
        market: event.market,
        asset: event.asset,
        side,
        order_type: 'market',
        position_size_pct: Math.min(MAX_POSITION_SIZE_PCT, 1),
        stop_loss_required: true,
        take_profit_required: true,
        source_event_url: event.sources?.[0] ?? event.url ?? null,
      },
      risk_gate: {
        passed: executionAllowed,
        reasons,
        min_impact: MIN_IMPACT,
        min_confidence: MIN_CONFIDENCE,
        kill_switch: KILL_SWITCH,
      },
    },
  };
});`;
}

function parseModelOutputCode() {
  return `return $input.all().map((item) => {
  const json = item.json;
  const raw = json.output ?? json.text ?? json.message ?? json.response ?? JSON.stringify(json);
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^\\\`\\\`\\\`json\\s*/i, '').replace(/\\\`\\\`\\\`$/i, '').trim()) : raw;
  } catch {
    parsed = {
      market: json.market,
      asset: json.asset,
      bias: 'neutral',
      sentiment_score: 0,
      impact_score: 0,
      confidence: 0,
      time_horizon: 'intraday',
      risk_flags: ['ai_parse_failed'],
      trade_recommendation: 'watch_only',
      reasoning: String(raw).slice(0, 500),
      sources: [json.url].filter(Boolean),
    };
  }
  return { json: { ...json, ...parsed, scored_at: new Date().toISOString() } };
});`;
}

function routeCode() {
  return `return $input.all().map((item) => {
  const event = item.json;
  const shouldAlert = event.execution_allowed || event.impact_score >= 70 || Math.abs(event.sentiment_score) >= 7 || event.trade_recommendation === 'alert' || event.trade_recommendation === 'avoid_trading';
  const priority = event.execution_allowed || event.trade_recommendation === 'avoid_trading' || event.impact_score >= 85 ? 'high' : shouldAlert ? 'medium' : 'log_only';
  const emoji = event.bias === 'bullish' ? '🟢' : event.bias === 'bearish' ? '🔴' : '⚪';
  const message = [
    \`\${emoji} \${event.market?.toUpperCase()} \${event.asset} | \${event.bias} | impact \${event.impact_score}/100 | confidence \${Math.round((event.confidence ?? 0) * 100)}%\`,
    event.execution_allowed ? \`TRADE PROPOSAL: \${event.order?.side?.toUpperCase()} \${event.order?.asset} | \${event.execution_mode?.toUpperCase()} mode\` : '',
    event.headline,
    event.reasoning,
    event.risk_gate?.reasons?.length ? \`Risk gate: \${event.risk_gate.reasons.join(', ')}\` : '',
    event.risk_flags?.length ? \`Risk flags: \${event.risk_flags.join(', ')}\` : '',
    event.sources?.[0] ? \`Source: \${event.sources[0]}\` : ''
  ].filter(Boolean).join('\\n');

  return {
    json: {
      ...event,
      shouldAlert,
      priority,
      alert_message: message,
    },
  };
});`;
}

function dailyReportCode() {
  return `const events = $input.all().map((item) => item.json);
const byMarket = events.reduce((acc, event) => {
  const key = event.market ?? 'unknown';
  acc[key] ??= [];
  acc[key].push(event);
  return acc;
}, {});

const sections = Object.entries(byMarket).map(([market, rows]) => {
  const top = rows
    .sort((a, b) => (b.impact_score ?? 0) - (a.impact_score ?? 0))
    .slice(0, 5)
    .map((event) => \`- \${event.asset}: \${event.bias} | impact \${event.impact_score}/100 | \${event.headline}\`)
    .join('\\n');
  return \`## \${market.toUpperCase()}\\n\${top || '- No notable events'}\`;
});

return [{
  json: {
    report_title: \`Tri-Market Sentinel Daily Brief - \${new Date().toISOString().slice(0, 10)}\`,
    report_body: sections.join('\\n\\n'),
    event_count: events.length,
  }
}];`;
}

function collectorWorkflow({ workflowId, name, market, assets, eventTypes, urls }) {
  const nodes = [
    sticky('Config', `# ${name}\\n\\nRuns on a schedule and normalizes market news into the shared event contract.\\n\\nConfigure real sources in the HTTP nodes. Add NewsAPI/Finnhub/Alpha Vantage credentials as needed.`, [-640, -220]),
    manual('Manual test', [-640, 80]),
    schedule('Every 30 minutes', [-640, 280], 30),
    ...urls.map((url, index) => httpGet(`Fetch source ${index + 1}`, url, [-360, 40 + index * 180])),
    code('Normalize events', collectorCode({ market, assets, eventTypes }), [0, 180]),
    executeWorkflow('Send to Unified Scoring Engine', 'TriMarketScoringEngine01', [320, 180]),
  ];
  return workflow({
    workflowId,
    name,
    nodes,
    connections: {
      'Manual test': { main: [urls.map((_, index) => ({ node: `Fetch source ${index + 1}`, type: 'main', index }))] },
      'Every 30 minutes': { main: [urls.map((_, index) => ({ node: `Fetch source ${index + 1}`, type: 'main', index }))] },
      ...Object.fromEntries(urls.map((_, index) => [`Fetch source ${index + 1}`, { main: [[{ node: 'Normalize events', type: 'main', index: 0 }]] }])),
      'Normalize events': { main: [[{ node: 'Send to Unified Scoring Engine', type: 'main', index: 0 }]] },
    },
  });
}

function scoringWorkflow() {
  const nodes = [
    sticky('Scoring Config', '# Unified Scoring Engine\\n\\nReceives normalized events from all collectors.\\n\\nReplace the placeholder OpenAI node with Anthropic/Claude if preferred. The prompt is designed to output strict JSON.', [-580, -220], [560, 300], 5),
    code('Build scoring prompts', scoringCodePrompt(), [-580, 120]),
    openAiModel('OpenAI Chat Model', [-280, 340]),
    {
      id: id(),
      name: 'AI Sentiment Analyst',
      type: '@n8n/n8n-nodes-langchain.chainLlm',
      typeVersion: 1.6,
      position: [-220, 120],
      parameters: {
        promptType: 'define',
        text: '={{ $json.scoring_prompt }}',
        messages: {
          messageValues: [],
        },
      },
    },
    code('Parse score JSON', parseModelOutputCode(), [120, 120]),
    executeWorkflow('Send to Signal & Risk Gate', 'TriVectorSignalRiskGate01', [460, 120]),
  ];
  return workflow({
    workflowId: 'TriMarketScoringEngine01',
    name: 'trivectorlabs.ai - Unified Scoring Engine',
    nodes,
    connections: {
      'Build scoring prompts': { main: [[{ node: 'AI Sentiment Analyst', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'AI Sentiment Analyst', type: 'ai_languageModel', index: 0 }]] },
      'AI Sentiment Analyst': { main: [[{ node: 'Parse score JSON', type: 'main', index: 0 }]] },
      'Parse score JSON': { main: [[{ node: 'Send to Signal & Risk Gate', type: 'main', index: 0 }]] },
    },
  });
}

function alertRouterWorkflow() {
  const nodes = [
    sticky('Alert Routing', '# Alert Router\\n\\nRoutes high-impact events to Telegram/Discord and logs everything.\\n\\nConfigure Telegram, Discord, and Google Sheets nodes after import. Current workflow produces `alert_message`, `priority`, and `shouldAlert` fields.', [-560, -220], [560, 280], 3),
    code('Decide routing', routeCode(), [-560, 120]),
    {
      id: id(),
      name: 'High priority?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [-220, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: id(),
              leftValue: '={{ $json.shouldAlert }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: id(),
      name: 'Telegram Alert Placeholder',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [100, 20],
      parameters: {},
    },
    {
      id: id(),
      name: 'Google Sheets Log Placeholder',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [100, 220],
      parameters: {},
    },
  ];
  return workflow({
    workflowId: 'TriMarketAlertRouter01',
    name: 'trivectorlabs.ai - Alert Router',
    nodes,
    connections: {
      'Decide routing': { main: [[{ node: 'High priority?', type: 'main', index: 0 }]] },
      'High priority?': {
        main: [
          [{ node: 'Telegram Alert Placeholder', type: 'main', index: 0 }],
          [{ node: 'Google Sheets Log Placeholder', type: 'main', index: 0 }],
        ],
      },
      'Telegram Alert Placeholder': { main: [[{ node: 'Google Sheets Log Placeholder', type: 'main', index: 0 }]] },
    },
  });
}

function signalRiskGateWorkflow() {
  const nodes = [
    sticky('Execution Safety', '# Signal & Risk Gate\\n\\nTurns AI-scored events into trade proposals.\\n\\nExecution is paper-mode by default. Live trading requires explicit env/config changes, broker credentials, SL/TP, trade limits, and kill switch off.\\n\\nInspired by the AI Forex Trader template, but upgraded for crypto + stocks + forex.', [-700, -260], [620, 360], 5),
    executeWorkflowTrigger('When Scoring Engine Sends Event', [-700, 160]),
    code('Generate Signal + Risk Gate', signalRiskGateCode(), [-340, 160]),
    executeWorkflow('Send alert/log', 'TriMarketAlertRouter01', [40, -80]),
    {
      id: id(),
      name: 'Execution allowed?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [40, 160],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: id(),
              leftValue: '={{ $json.execution_allowed }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: id(),
      name: 'Market is Crypto?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [340, 80],
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: id(),
              leftValue: '={{ $json.market }}',
              rightValue: 'crypto',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: id(),
      name: 'Market is Stocks?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [640, 200],
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: id(),
              leftValue: '={{ $json.market }}',
              rightValue: 'stocks',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    executeWorkflow('Execute Crypto Trade', 'TriVectorCryptoExecution01', [660, 0]),
    executeWorkflow('Execute Stocks Trade', 'TriVectorStocksExecution01', [960, 120]),
    executeWorkflow('Execute Forex MT5 Trade', 'TriVectorForexMT5Execution01', [960, 320]),
  ];

  return workflow({
    workflowId: 'TriVectorSignalRiskGate01',
    name: 'trivectorlabs.ai - Signal & Risk Gate',
    nodes,
    connections: {
      'When Scoring Engine Sends Event': { main: [[{ node: 'Generate Signal + Risk Gate', type: 'main', index: 0 }]] },
      'Generate Signal + Risk Gate': {
        main: [[
          { node: 'Send alert/log', type: 'main', index: 0 },
          { node: 'Execution allowed?', type: 'main', index: 0 },
        ]],
      },
      'Execution allowed?': {
        main: [
          [{ node: 'Market is Crypto?', type: 'main', index: 0 }],
          [],
        ],
      },
      'Market is Crypto?': {
        main: [
          [{ node: 'Execute Crypto Trade', type: 'main', index: 0 }],
          [{ node: 'Market is Stocks?', type: 'main', index: 0 }],
        ],
      },
      'Market is Stocks?': {
        main: [
          [{ node: 'Execute Stocks Trade', type: 'main', index: 0 }],
          [{ node: 'Execute Forex MT5 Trade', type: 'main', index: 0 }],
        ],
      },
    },
  });
}

function executionWorkflow({ workflowId, name, market, venueLabel, endpointLabel }) {
  const nodes = [
    sticky('Execution Module', `# ${name}\\n\\nReceives a risk-approved trade proposal from the Signal & Risk Gate.\\n\\nDefault behavior is paper execution. Replace placeholder HTTP nodes with real ${venueLabel} API calls only after demo testing and risk review.`, [-660, -260], [620, 340], 6),
    executeWorkflowTrigger('When Risk Gate Approves Trade', [-660, 120]),
    code('Validate execution request', `return $input.all().map((item) => {
  const trade = item.json;
  const errors = [];
  if (trade.market !== '${market}') errors.push('wrong_market');
  if (!trade.execution_allowed) errors.push('execution_not_allowed');
  if (!trade.order?.asset) errors.push('missing_asset');
  if (!['buy', 'sell'].includes(trade.order?.side)) errors.push('invalid_side');
  if (!trade.order?.stop_loss_required || !trade.order?.take_profit_required) errors.push('missing_required_risk_controls');
  return { json: { ...trade, execution_validation: { passed: errors.length === 0, errors } } };
});`, [-300, 120]),
    {
      id: id(),
      name: 'Validation passed?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [20, 120],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
          conditions: [
            {
              id: id(),
              leftValue: '={{ $json.execution_validation.passed }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    code('Paper execution fill', `return $input.all().map((item) => {
  const trade = item.json;
  return {
    json: {
      ...trade,
      execution_result: {
        status: trade.execution_mode === 'paper' ? 'paper_filled' : 'ready_for_live_api',
        venue: '${venueLabel}',
        endpoint: '${endpointLabel}',
        executed_at: new Date().toISOString(),
        order_id: \`paper_${market}_\${Date.now()}\`,
        message: trade.execution_mode === 'paper'
          ? 'Paper trade recorded. Replace this node with real broker/exchange execution after testing.'
          : 'Live mode requested. Add real authenticated HTTP request node before enabling.',
      },
    },
  };
});`, [360, 40]),
    {
      id: id(),
      name: 'Live API Placeholder',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [360, 240],
      parameters: {},
    },
    executeWorkflow('Log and alert execution result', 'TriMarketAlertRouter01', [700, 120]),
  ];

  return workflow({
    workflowId,
    name,
    nodes,
    connections: {
      'When Risk Gate Approves Trade': { main: [[{ node: 'Validate execution request', type: 'main', index: 0 }]] },
      'Validate execution request': { main: [[{ node: 'Validation passed?', type: 'main', index: 0 }]] },
      'Validation passed?': {
        main: [
          [{ node: 'Paper execution fill', type: 'main', index: 0 }],
          [{ node: 'Log and alert execution result', type: 'main', index: 0 }],
        ],
      },
      'Paper execution fill': { main: [[{ node: 'Log and alert execution result', type: 'main', index: 0 }]] },
      'Live API Placeholder': { main: [[{ node: 'Log and alert execution result', type: 'main', index: 0 }]] },
    },
  });
}

function reportWorkflow() {
  const nodes = [
    sticky('Daily Brief', '# trivectorlabs.ai Daily Intelligence Report\\n\\nScheduled summary across crypto, stocks, forex, trade proposals, and execution confirmations.\\n\\nLater we will read from Google Sheets/Postgres and compile a polished Telegram/Discord/email report.', [-560, -220], [560, 260], 6),
    schedule('Daily report schedule', [-560, 100], 1440),
    webhook('Manual report webhook', 'tri-market-daily-report', [-560, 300]),
    code('Compile daily report', dailyReportCode(), [-160, 180]),
    respond('Return report JSON', [180, 180]),
  ];
  return workflow({
    workflowId: 'TriMarketDailyReport01',
    name: 'trivectorlabs.ai - Daily Intelligence Report',
    nodes,
    connections: {
      'Daily report schedule': { main: [[{ node: 'Compile daily report', type: 'main', index: 0 }]] },
      'Manual report webhook': { main: [[{ node: 'Compile daily report', type: 'main', index: 0 }]] },
      'Compile daily report': { main: [[{ node: 'Return report JSON', type: 'main', index: 0 }]] },
    },
  });
}

const sharedEventTypes = [
  { type: 'regulation', keywords: ['sec', 'regulation', 'regulator', 'lawsuit', 'ban', 'approval'] },
  { type: 'etf', keywords: ['etf', 'spot etf', 'inflows', 'outflows'] },
  { type: 'hack', keywords: ['hack', 'exploit', 'breach', 'stolen', 'drain'] },
  { type: 'earnings', keywords: ['earnings', 'revenue', 'guidance', 'eps'] },
  { type: 'macro', keywords: ['cpi', 'inflation', 'nfp', 'payrolls', 'gdp', 'yields', 'rates'] },
  { type: 'central_bank', keywords: ['fed', 'fomc', 'ecb', 'boe', 'boj', 'powell', 'lagarde'] },
  { type: 'geopolitical', keywords: ['war', 'sanctions', 'election', 'conflict', 'tariff'] },
];

const workflows = [
  [
    'crypto-intel-collector.json',
    collectorWorkflow({
      workflowId: 'TriMarketCryptoCollector01',
      name: 'trivectorlabs.ai - Crypto Intel Collector',
      market: 'crypto',
      assets: [
        { symbol: 'BTC', aliases: ['bitcoin', 'btc'] },
        { symbol: 'ETH', aliases: ['ethereum', 'eth'] },
        { symbol: 'SOL', aliases: ['solana', 'sol'] },
        { symbol: 'BNB', aliases: ['bnb', 'binance'] },
        { symbol: 'XRP', aliases: ['xrp', 'ripple'] },
      ],
      eventTypes: sharedEventTypes,
      urls: [
        'https://newsapi.org/v2/everything?q=bitcoin%20OR%20ethereum%20OR%20crypto&language=en&sortBy=publishedAt&apiKey=YOUR_NEWSAPI_KEY',
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
      ],
    }),
  ],
  [
    'stocks-intel-collector.json',
    collectorWorkflow({
      workflowId: 'TriMarketStocksCollector01',
      name: 'trivectorlabs.ai - Stocks Intel Collector',
      market: 'stocks',
      assets: [
        { symbol: 'SPY', aliases: ['s&p 500', 'spy', 'equities'] },
        { symbol: 'QQQ', aliases: ['nasdaq', 'qqq'] },
        { symbol: 'NVDA', aliases: ['nvidia', 'nvda'] },
        { symbol: 'TSLA', aliases: ['tesla', 'tsla'] },
        { symbol: 'AAPL', aliases: ['apple', 'aapl'] },
        { symbol: 'MSFT', aliases: ['microsoft', 'msft'] },
      ],
      eventTypes: sharedEventTypes,
      urls: [
        'https://newsapi.org/v2/everything?q=stocks%20OR%20earnings%20OR%20NASDAQ%20OR%20S%26P&language=en&sortBy=publishedAt&apiKey=YOUR_NEWSAPI_KEY',
        'https://www.sec.gov/news/pressreleases.rss',
      ],
    }),
  ],
  [
    'forex-macro-intel-collector.json',
    collectorWorkflow({
      workflowId: 'TriMarketForexCollector01',
      name: 'trivectorlabs.ai - Forex Macro Intel Collector',
      market: 'forex',
      assets: [
        { symbol: 'EURUSD', aliases: ['eur/usd', 'euro dollar', 'eurusd', 'euro'] },
        { symbol: 'GBPUSD', aliases: ['gbp/usd', 'pound dollar', 'gbpusd', 'sterling'] },
        { symbol: 'USDJPY', aliases: ['usd/jpy', 'yen', 'usdjpy'] },
        { symbol: 'USDCHF', aliases: ['usd/chf', 'swiss franc', 'usdchf'] },
        { symbol: 'AUDUSD', aliases: ['aud/usd', 'aussie', 'audusd'] },
        { symbol: 'XAUUSD', aliases: ['gold', 'xauusd', 'xau/usd'] },
        { symbol: 'DXY', aliases: ['dxy', 'dollar index', 'us dollar'] },
      ],
      eventTypes: sharedEventTypes,
      urls: [
        'https://newsapi.org/v2/everything?q=forex%20OR%20federal%20reserve%20OR%20ECB%20OR%20gold%20OR%20inflation&language=en&sortBy=publishedAt&apiKey=YOUR_NEWSAPI_KEY',
        'https://www.federalreserve.gov/feeds/press_all.xml',
      ],
    }),
  ],
  ['unified-scoring-engine.json', scoringWorkflow()],
  ['signal-risk-gate.json', signalRiskGateWorkflow()],
  [
    'crypto-execution.json',
    executionWorkflow({
      workflowId: 'TriVectorCryptoExecution01',
      name: 'trivectorlabs.ai - Crypto Execution',
      market: 'crypto',
      venueLabel: 'Exchange API',
      endpointLabel: 'Binance / Bybit / OKX order endpoint',
    }),
  ],
  [
    'stocks-execution.json',
    executionWorkflow({
      workflowId: 'TriVectorStocksExecution01',
      name: 'trivectorlabs.ai - Stocks Execution',
      market: 'stocks',
      venueLabel: 'Broker API',
      endpointLabel: 'Alpaca / IBKR / Tradier order endpoint',
    }),
  ],
  [
    'forex-mt5-execution.json',
    executionWorkflow({
      workflowId: 'TriVectorForexMT5Execution01',
      name: 'trivectorlabs.ai - Forex MT5 Execution',
      market: 'forex',
      venueLabel: 'MT5 Bridge',
      endpointLabel: 'MT5 Expert Advisor polling/ack endpoint',
    }),
  ],
  ['alert-router.json', alertRouterWorkflow()],
  ['daily-intelligence-report.json', reportWorkflow()],
];

for (const [filename, data] of workflows) {
  writeFileSync(join(outDir, filename), `${JSON.stringify(data, null, 2)}\n`);
}

console.log(`Generated ${workflows.length} workflow files`);
