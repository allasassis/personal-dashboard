// Thin wrapper over the GitHub Contents API, called directly from the browser.

export interface RepoConfig {
  owner: string;
  repo: string;
  token: string;
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = input
    .trim()
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .match(/^(?:https?:\/\/(?:www\.)?github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

// btoa/atob only handle Latin-1, so text goes through UTF-8 bytes first.
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export class GitHubClient {
  constructor(
    private cfg: RepoConfig,
    private fetchFn: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const res = await this.fetchFn(`https://api.github.com/repos/${this.cfg.owner}/${this.cfg.repo}${path}`, {
      ...init,
      // GitHub sends max-age=60. Without this, the browser can serve a stale file
      // right after another device (or this one) wrote a new version.
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...init?.headers,
      },
    });
    return res;
  }

  private async fail(res: Response): Promise<never> {
    let detail = '';
    try {
      detail = (await res.json()).message ?? '';
    } catch {
      /* no JSON body */
    }
    throw new GitHubError(res.status, detail || `GitHub responded with ${res.status}`);
  }

  async getRepo(): Promise<{ private: boolean; full_name: string }> {
    const res = await this.request('');
    if (!res.ok) await this.fail(res);
    return res.json();
  }

  /** Returns null when the file does not exist (also true for an empty repo). */
  async getFile(path: string): Promise<{ sha: string; text: string } | null> {
    const res = await this.request(`/contents/${path}`);
    if (res.status === 404) return null;
    if (!res.ok) await this.fail(res);
    const body: { sha: string; content?: string; encoding?: string } = await res.json();
    if (body.encoding === 'base64' && body.content !== undefined) {
      return { sha: body.sha, text: decodeBase64(body.content) };
    }
    // Over 1 MB the Contents API leaves the content out. The blob API goes up to 100 MB.
    const blob = await this.request(`/git/blobs/${body.sha}`);
    if (!blob.ok) await this.fail(blob);
    return { sha: body.sha, text: decodeBase64((await blob.json()).content) };
  }

  /** Writes a file and returns its new sha. A stale sha fails with 409 (or 422). */
  async putFile(path: string, text: string, sha: string | null, message: string): Promise<string> {
    const res = await this.request(`/contents/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: encodeBase64(text), ...(sha ? { sha } : {}) }),
    });
    if (!res.ok) await this.fail(res);
    return (await res.json()).content.sha;
  }
}

export function explainError(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return 'GitHub rejected the token. It may have expired, so paste a new one in Settings.';
    if (e.status === 429 || /rate limit/i.test(e.message)) return 'GitHub rate limit reached. Sync will retry shortly.';
    if (e.status === 403) return 'The token cannot write to this repo. It needs Contents: Read and write.';
    if (e.status === 404) return 'Repo not found. Check the name, and that the token was given access to this repo.';
    return `GitHub error ${e.status}: ${e.message}`;
  }
  if (e instanceof TypeError) return 'Could not reach GitHub. Check your connection.';
  return e instanceof Error ? e.message : String(e);
}
