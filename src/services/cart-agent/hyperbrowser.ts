import { jumboHandoffPrompt, storeSearchPrompt } from './prompts';
import { CartRequestItem } from './types';

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface HyperbrowserTask {
  jobId: string;
  liveUrl: string | null;
  status?: string;
  finalResult?: string | null;
  error?: string | null;
}

export interface HyperbrowserConfig {
  apiKey: string;
  baseUrl: string;
  llm: string;
  useStealth: boolean;
  proxyCountry?: string;
}

export function readHyperbrowserConfig(
  env: Record<string, string | undefined> = process.env
): HyperbrowserConfig | null {
  const provider = (env.BROWSER_AGENT_PROVIDER || 'hyperbrowser').toLowerCase();
  if (provider === 'off' || provider === 'none') return null;
  const apiKey = env.HYPERBROWSER_API_KEY || env.BROWSER_AGENT_KEY || '';
  if (!apiKey) return null;
  const proxyCountry = env.HYPERBROWSER_PROXY_COUNTRY?.trim();
  return {
    apiKey,
    baseUrl: (env.BROWSER_AGENT_URL || 'https://api.hyperbrowser.ai').replace(/\/$/, ''),
    llm: env.HYPERBROWSER_LLM || 'gpt-4o-mini',
    useStealth: env.HYPERBROWSER_STEALTH !== '0',
    proxyCountry: proxyCountry || undefined,
  };
}

export class HyperbrowserClient {
  constructor(
    private readonly config: HyperbrowserConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private async request(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        ...(init?.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) as Record<string, unknown> : {};
    if (!response.ok) {
      const message = typeof data.message === 'string' ? data.message : `Hyperbrowser respondió ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  async startTask(task: string, maxSteps: number): Promise<HyperbrowserTask> {
    const sessionOptions: Record<string, unknown> = {
      useStealth: this.config.useStealth,
      locales: ['es'],
      adblock: true,
      solveCaptchas: false,
    };
    if (this.config.proxyCountry) {
      sessionOptions.useProxy = true;
      sessionOptions.proxyCountry = this.config.proxyCountry;
    }
    const data = await this.request('/api/task/hyper-agent', {
      method: 'POST',
      body: JSON.stringify({
        task,
        version: '1.1.0',
        llm: this.config.llm,
        maxSteps,
        keepBrowserOpen: true,
        sessionOptions,
      }),
    });
    const jobId = String(data.jobId || '');
    if (!jobId) throw new Error('Hyperbrowser no entregó un jobId');
    return {
      jobId,
      liveUrl: typeof data.liveUrl === 'string' ? data.liveUrl : null,
    };
  }

  startJumboHandoff(sessionId: string): Promise<HyperbrowserTask> {
    return this.startTask(jumboHandoffPrompt(sessionId), 8);
  }

  startStoreFill(store: 'unimarc' | 'tottus', items: CartRequestItem[]): Promise<HyperbrowserTask> {
    const steps = Math.min(40, 8 + items.length * 4);
    return this.startTask(storeSearchPrompt(store, items), steps);
  }

  async getTask(jobId: string): Promise<HyperbrowserTask> {
    const data = await this.request(`/api/task/hyper-agent/${encodeURIComponent(jobId)}`);
    const nested = (data.data && typeof data.data === 'object') ? data.data as Record<string, unknown> : {};
    return {
      jobId: String(data.jobId || jobId),
      status: typeof data.status === 'string' ? data.status : undefined,
      liveUrl: typeof data.liveUrl === 'string' ? data.liveUrl : null,
      finalResult: typeof nested.finalResult === 'string' ? nested.finalResult : null,
      error: typeof data.error === 'string' ? data.error : null,
    };
  }
}
