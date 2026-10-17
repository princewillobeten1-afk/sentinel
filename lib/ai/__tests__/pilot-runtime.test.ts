import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  tool: vi.fn(),
  getTurns: vi.fn(),
  save: vi.fn(),
  usage: vi.fn(),
  reserve: vi.fn(),
  pause: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: mocks.create,
      },
    };
  },
}));
vi.mock('../pilot/tools', () => ({ executeSkill: mocks.tool }));
vi.mock('../pilot/repository', () => ({ getTurns: mocks.getTurns, saveTurn: mocks.save, recordUsage: mocks.usage }));
vi.mock('../pilot/quota', () => ({ reserveModelCall: mocks.reserve, pauseModel: mocks.pause }));
vi.mock('@/lib/server/logger', () => ({ logger: { warn: vi.fn() } }));

import { runPilot, modelHistory, retryDelay } from '../pilot/runtime';
import { fact } from '../pilot/evidence';
import { buildInsights } from '../pilot/insights';
import type { PilotEvent, PilotRequest, SavedTurn } from '../pilot/contracts';

const mint = 'So11111111111111111111111111111111111111112';
const request: PilotRequest = {
  requestId: crypto.randomUUID(),
  question: 'Assess this token',
  context: { page: 'trade', chain: 'solana', mint, timeframe: '1m', displayUnit: 'price' },
  privacyAccepted: true,
};
const measured = fact(
  { mint, metric: 'price', label: 'Price', value: 1, unit: 'USD', category: 'market' },
  { status: 'measured', source: 'private-integration-name', observedAt: new Date().toISOString() }
);

beforeEach(() => {
  vi.resetAllMocks();
  Object.entries({
    NVIDIA_API_KEY: 'test-key-not-real',
    AI_PILOT_ENABLED: 'true',
    AI_FREE_TIER_CONFIRMED: 'true',
    AI_MODEL_RPM: '30',
    AI_MODEL_TPM: '100000',
    AI_MODEL_RPD: '500',
  }).forEach(([k, v]) => vi.stubEnv(k, v));
  mocks.getTurns.mockResolvedValue([]);
  mocks.save.mockResolvedValue(undefined);
  mocks.usage.mockResolvedValue(undefined);
  mocks.reserve.mockResolvedValue(undefined);
  mocks.pause.mockResolvedValue(undefined);
  mocks.tool.mockResolvedValue({ facts: [measured], notes: [] });
});
afterEach(() => vi.unstubAllEnvs());

async function* callStream(names = ['token_assessment'], thought = 'signature-must-survive') {
  yield {
    choices: [
      {
        delta: {
          reasoning_content: thought,
          tool_calls: names.map((name, i) => ({
            index: i,
            id: String(i),
            function: { name, arguments: JSON.stringify({ mint }) },
          })),
        },
      },
    ],
  };
}

async function* answerStream(rawJson?: string) {
  yield {
    choices: [
      {
        delta: {
          reasoning_content: 'thought-process',
          content: rawJson ?? JSON.stringify({
            insightIds: [buildInsights([measured]).find(i => i.title === 'Overview')!.id],
          }),
        },
      },
    ],
  };
}

const call = (names = ['token_assessment']) => callStream(names);
const answer = (rawJson?: string) => answerStream(rawJson);

it('executes a real SDK tool loop, retains thought signatures, and records actual usage', async () => {
  mocks.create.mockImplementationOnce(async () => call()).mockImplementationOnce(async () => answer());
  const events: PilotEvent[] = [];
  await runPilot('private-user', 'session', request, new AbortController().signal, e => events.push(e));
  expect(mocks.tool).toHaveBeenCalledWith('token_assessment', { mint }, expect.any(AbortSignal));
  const outbound = mocks.create.mock.calls[1][0];
  expect(JSON.stringify(outbound)).toContain('signature-must-survive');
  expect(JSON.stringify(outbound)).not.toContain('private-user');
  expect(JSON.stringify(events)).not.toMatch(/private-integration-name|test-key-not-real|signature-must-survive/);
  expect(events.some(e => e.type === 'answer' && e.answer.validated)).toBe(true);
  expect(mocks.usage).toHaveBeenCalledWith(expect.objectContaining({ status: 'complete' }));
});

it.each(['Buy 0.5 SOL', 'My wallet balance is 10', 'Analyze my trading history', 'password=secret'])('blocks %s before outbound calls', async question => {
  await expect(runPilot('u', 's', { ...request, question }, new AbortController().signal, () => undefined)).rejects.toMatchObject({ code: 'AI_PUBLIC_DATA_ONLY' });
  expect(mocks.create).not.toHaveBeenCalled();
});

it('keeps evidence but rejects fabricated responses', async () => {
  mocks.create.mockImplementationOnce(async () => call()).mockImplementationOnce(async () => answer('{"insightIds":["fake"]}'));
  const events: PilotEvent[] = [];
  await runPilot('u', 's', request, new AbortController().signal, e => events.push(e));
  expect(events.some(e => e.type === 'evidence' && e.facts[0].value === 1)).toBe(true);
  expect(events.some(e => e.type === 'answer' && !e.answer.validated)).toBe(true);
});

it('never exceeds four model rounds', async () => {
  mocks.create.mockImplementation(async () => call());
  await runPilot('u', 's', request, new AbortController().signal, () => undefined);
  expect(mocks.create).toHaveBeenCalledTimes(4);
  expect(mocks.create.mock.calls[3][0].tools).toBeUndefined();
});

it('rejects a batch beyond eight tool calls', async () => {
  mocks.create.mockImplementation(async () => call(Array(9).fill('token_assessment')));
  await runPilot('u', 's', request, new AbortController().signal, () => undefined);
  expect(mocks.tool).not.toHaveBeenCalled();
});

it('memoizes duplicate tool arguments within the answer', async () => {
  mocks.create.mockImplementationOnce(async () => call(['token_assessment', 'token_assessment'])).mockImplementationOnce(async () => answer());
  await runPilot('u', 's', request, new AbortController().signal, () => undefined);
  expect(mocks.tool).toHaveBeenCalledTimes(1);
});

it('stops without retries or fallback on quota exhaustion', async () => {
  mocks.create.mockRejectedValue({ status: 429, message: '{"retryDelay":"125s"} credential=https://secret.invalid' });
  const events: PilotEvent[] = [];
  await runPilot('u', 's', request, new AbortController().signal, e => events.push(e));
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.pause).toHaveBeenCalledWith(125);
  expect(JSON.stringify(events)).not.toContain('secret.invalid');
  expect(events.some(e => e.type === 'error' && e.code === 'AI_QUOTA_EXHAUSTED')).toBe(true);
});

it('does not call the model after cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await runPilot('u', 's', request, controller.signal, () => undefined);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

it('stops before another model round on cancellation during a tool', async () => {
  const controller = new AbortController();
  mocks.create.mockImplementation(async () => call());
  mocks.tool.mockImplementation(async () => {
    controller.abort();
    return { facts: [measured], notes: [] };
  });
  await runPilot('u', 's', request, controller.signal, () => undefined);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.save).not.toHaveBeenCalled();
});

it('does not call the model when Redis budget reservation fails', async () => {
  mocks.reserve.mockRejectedValue(new Error('redis unavailable'));
  await runPilot('u', 's', request, new AbortController().signal, () => undefined);
  expect(mocks.create).not.toHaveBeenCalled();
});

it('keeps old private history outside model context and retains public context', () => {
  const turn = { ...request, id: 'id', facts: [], answer: { validated: true, sections: [] }, createdAt: new Date().toISOString() } as SavedTurn;
  expect(modelHistory([{ ...turn, question: 'My wallet is ABC' }])).toEqual([]);
  expect(JSON.stringify(modelHistory([turn]))).toContain(mint);
});

it('honors Retry-After headers', () => expect(retryDelay({ response: { headers: new Headers({ 'retry-after': '600' }) } })).toBe(600));
it('uses a bounded pause if no retry guidance exists', () => expect(retryDelay({})).toBe(3600));
