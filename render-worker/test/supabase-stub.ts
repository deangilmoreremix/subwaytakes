/**
 * In-memory Supabase stub for the render-worker staging validation suite.
 *
 * There is no Supabase (or Docker) in this environment, so the worker's
 * storage layer is pointed at this stub through
 * `setSupabaseClientFactory()` (the only test seam in src/). It implements
 * exactly the PostgREST / Storage surface the worker calls — enumerated in
 * `src/storage.ts` and mirrored here:
 *
 *   supabase.from('studio_render_jobs')
 *     .select('*').eq('status','queued').order('created_at',{ascending:true}).limit(1)
 *   supabase.from('studio_render_jobs')
 *     .update({...}).eq('id', id).eq('status','queued').select().single()
 *   supabase.from('studio_render_jobs')
 *     .select('id, worker_id').eq('status','running').lt('updated_at', cutoff)
 *   supabase.from('studio_render_jobs').update({...}).in('id', ids).eq('status','running')
 *   supabase.from('studio_render_jobs').update({progress, updated_at}).eq('id', jobId).eq('status','running')
 *   supabase.from('studio_render_jobs').update({updated_at}).eq('id', jobId).eq('status','running')
 *   supabase.from('studio_render_jobs').update({status, output_url, ...}).eq('id', jobId)
 *   supabase.from('studio_projects').select('project').eq('id', projectId).single()
 *   supabase.from('studio_render_jobs').select('id', { count:'exact', head:true }).eq('status', ...)
 *   supabase.storage.from(bucket).upload(path, stream, { contentType, upsert })
 *   supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
 *
 * The store is guarded by a mutex so UPDATEs commit one at a time (that is what
 * makes the "exactly-once claim" assertion meaningful), while an artificial
 * network latency between statements lets concurrent callers interleave the
 * SELECT and UPDATE halves of the claim.
 */
import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RenderJobRow } from '../src/storage';

export type StubJobRow = RenderJobRow;

/** Every statement the worker executed against the stub, in order. */
export interface StubCall {
  op: 'select' | 'update' | 'upload' | 'createSignedUrl';
  table?: string;
  columns?: string | null;
  payload?: Record<string, unknown>;
  filters?: { column: string; kind: string; value: unknown }[];
  matched: number;
  /** ids of rows the statement touched (after filtering). */
  ids: string[];
  /** candidate row chosen by the claim SELECT (status was still 'queued'). */
  candidateId?: string | null;
  bucket?: string;
  path?: string;
  contentType?: string;
  upsert?: boolean;
  bytes?: number;
  expiresIn?: number;
  at: number;
}

export interface SupabaseStubOptions {
  /**
   * Emulated per-statement network latency. Statements are issued
   * concurrently (outside the store mutex) and then applied one at a time, so
   * a non-zero value widens the window in which concurrent claimers overlap.
   */
  latencyMs?: number;
  /**
   * Model what real PostgREST+postgrest-js answer for a zero-row `.single()`:
   * a 406 / PGRST116 error instead of `{ data: null }`. The worker treats an
   * UPDATE error as a hard failure (`claim update failed: ...`), while a null
   * result means "lost the race, retry next poll". Both modes must still claim
   * exactly once.
   */
  strictSingleEmpty?: boolean;
  supabaseUrl?: string;
}

type Row = Record<string, unknown>;

interface Filter {
  kind: 'eq' | 'lt' | 'in';
  column: string;
  value: unknown;
}

export interface StubResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

// ---------------------------------------------------------------------------
// Mutex: serializes store mutations (stands in for the DB row guard)
// ---------------------------------------------------------------------------

export class Mutex {
  private chain: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.chain.then(() => fn());
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

// ---------------------------------------------------------------------------
// PostgREST-shaped query builder
// ---------------------------------------------------------------------------

class StubQueryBuilder<T = unknown> implements PromiseLike<StubResult<T>> {
  private columns: string | null = null;
  private payload: Row | null = null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private singleRow = false;
  private head = false;
  private countMode: 'exact' | null = null;
  private promise: Promise<StubResult<T>> | null = null;

  constructor(
    private readonly stub: SupabaseStub,
    private readonly table: string,
  ) {}

  select(
    columns?: string | { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
    options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
  ): this {
    if (typeof columns === 'string') this.columns = columns;
    const opts = (typeof columns === 'object' && columns !== null ? columns : options) ?? {};
    if (opts.count) this.countMode = opts.count as 'exact';
    if (opts.head) this.head = true;
    return this;
  }

  update(payload: Row): this {
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ kind: 'lt', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, value: values as unknown });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.singleRow = true;
    return this;
  }

  maybeSingle(): this {
    this.singleRow = true;
    return this;
  }

  /** Awaitable — executes once, on first `then`. */
  then<R1 = StubResult<T>, R2 = never>(
    onfulfilled?: ((value: StubResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    if (!this.promise) this.promise = this.execute();
    return this.promise.then(onfulfilled, onrejected);
  }

  private async execute(): Promise<StubResult<T>> {
    // 1. statements are issued "over the wire" — concurrently, outside the
    //    store lock, so racing callers really do interleave.
    if (this.stub.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.stub.latencyMs));
    }
    // 2. ...and are applied atomically, one at a time.
    return this.stub.mutex.run(() => this.apply());
  }

  private apply(): StubResult<T> {
    // A `.select()` chained after `.update()` means RETURNING, so the presence
    // of an update payload — not the last chain call — decides the statement.
    const isUpdate = this.payload !== null;
    const rows = this.matchingRows();
    const record: StubCall = {
      op: isUpdate ? 'update' : 'select',
      table: this.table,
      columns: this.columns,
      payload: this.payload ? { ...this.payload } : undefined,
      filters: this.filters.map((f) => ({ ...f })),
      matched: rows.length,
      ids: rows.map((r) => String(r.id)),
      at: Date.now(),
    };

    if (isUpdate) {
      const payload = this.payload ?? {};
      const before = rows.map((r) => ({ id: String(r.id), status: String(r.status) }));
      for (const row of rows) Object.assign(row, payload);
      this.stub.calls.push(record);
      for (const b of before) {
        const after = this.stub.jobs.get(b.id);
        if (after && after.status !== b.status) {
          this.stub.transitions.push({ id: b.id, from: b.status, to: after.status, at: record.at });
        }
      }
      if (this.singleRow) {
        const one = rows[0];
        if (!one && this.stub.strictSingleEmpty) {
          return {
            data: null as unknown as T,
            error: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
            },
          };
        }
        return { data: (one ?? null) as unknown as T, error: null };
      }
      return { data: null as unknown as T, error: null };
    }

    // ---- select ----
    this.stub.calls.push(record);
    let ordered = [...rows];
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      ordered.sort((a, b) => {
        const av = String(a[column] ?? '');
        const bv = String(b[column] ?? '');
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return ascending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== null) ordered = ordered.slice(0, this.limitCount);
    if (this.table === 'studio_render_jobs') {
      record.candidateId = ordered[0] ? String(ordered[0].id) : null;
    }

    if (this.head || this.countMode) {
      return { data: null as unknown as T, count: ordered.length, error: null };
    }
    if (this.singleRow) {
      const one = ordered[0];
      if (one === undefined && this.stub.strictSingleEmpty) {
        return {
          data: null as unknown as T,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        };
      }
      return { data: (one ?? null) as unknown as T, error: null };
    }
    return { data: ordered as unknown as T, error: null };
  }

  private matchingRows(): Row[] {
    const rows = this.stub.rowsFor(this.table);
    return rows.filter((row) =>
      this.filters.every((f) => {
        const cell = row[f.column];
        if (f.kind === 'eq') return cell === f.value;
        if (f.kind === 'lt') return String(cell ?? '') < String(f.value);
        const values = (f.value as unknown[]) ?? [];
        return values.includes(cell);
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Storage API shape (private bucket + signed URLs)
// ---------------------------------------------------------------------------

interface StoredObject {
  path: string;
  contentType: string;
  bytes: number;
  body: Buffer;
  uploadedAt: string;
}

class StubBucket {
  objects = new Map<string, StoredObject>();
  signedUrlCalls: { path: string; expiresIn: number }[] = [];

  constructor(
    private readonly bucket: string,
    private readonly stub: SupabaseStub,
  ) {}

  async upload(
    path: string,
    body: NodeJS.ReadableStream | Buffer | string,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<{ error: { message: string } | null }> {
    const chunks: Buffer[] = [];
    if (Buffer.isBuffer(body)) {
      chunks.push(body);
    } else if (typeof body === 'string') {
      chunks.push(Buffer.from(body));
    } else {
      const stream = body as unknown as EventEmitter;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (c: Buffer | string) => chunks.push(Buffer.from(c)));
        stream.on('error', reject);
        stream.on('end', resolve);
      });
    }
    const buffer = Buffer.concat(chunks);
    const existed = this.objects.has(path);
    if (existed && !options?.upsert) {
      return { error: { message: 'The resource already exists' } };
    }
    this.objects.set(path, {
      path,
      contentType: options?.contentType ?? 'application/octet-stream',
      bytes: buffer.length,
      body: buffer,
      uploadedAt: new Date().toISOString(),
    });
    this.stub.calls.push({
      op: 'upload',
      bucket: this.bucket,
      path,
      contentType: options?.contentType,
      upsert: options?.upsert,
      bytes: buffer.length,
      matched: existed ? 0 : 1,
      ids: [path],
      at: Date.now(),
    });
    return { error: null };
  }

  async createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string; path: string } | null; error: { message: string } | null }> {
    this.signedUrlCalls.push({ path, expiresIn });
    if (!this.objects.has(path)) {
      this.stub.calls.push({
        op: 'createSignedUrl',
        bucket: this.bucket,
        path,
        expiresIn,
        matched: 0,
        ids: [path],
        at: Date.now(),
      });
      return { data: null, error: { message: 'Object not found' } };
    }
    this.stub.calls.push({
      op: 'createSignedUrl',
      bucket: this.bucket,
      path,
      expiresIn,
      matched: 1,
      ids: [path],
      at: Date.now(),
    });
    // Mirrors the real signed-URL shape: <host>/storage/v1/object/sign/<bucket>/<path>?token=...
    const signedUrl =
      `${this.stub.supabaseUrl}/storage/v1/object/sign/${this.bucket}/` +
      `${path.split('/').map(encodeURIComponent).join('/')}?token=stub.jwt.token&expires_in=${expiresIn}`;
    return { data: { signedUrl, path }, error: null };
  }

  async download(path: string): Promise<{ data: Buffer | null; error: { message: string } | null }> {
    const object = this.objects.get(path);
    if (!object) return { data: null, error: { message: 'Object not found' } };
    return { data: object.body, error: null };
  }

  /**
   * The bucket is private: there is no unauthenticated object URL, only
   * signed ones. Mirrors storage.buckets.public = false for `studio-exports`.
   */
  getPublicUrl(path: string): { data: { publicUrl: string } } {
    const exists = this.objects.has(path);
    return { data: { publicUrl: exists ? `${this.stub.supabaseUrl}/storage/v1/object/authenticated/${this.bucket}/${path}` : '' } };
  }
}

// ---------------------------------------------------------------------------
// The stub client
// ---------------------------------------------------------------------------

export interface SupabaseStub {
  /** Shape-compatible with what @supabase/supabase-js's createClient returns. */
  readonly client: SupabaseClient;
  jobs: Map<string, StubJobRow>;
  projects: Row[];
  calls: StubCall[];
  transitions: { id: string; from: string; to: string; at: number }[];
  mutex: Mutex;
  latencyMs: number;
  strictSingleEmpty: boolean;
  supabaseUrl: string;
  from(table: string): StubQueryBuilder<unknown>;
  storage: { from(bucket: string): StubBucket };
  rowsFor(table: string): Row[];
  bucket(bucket: string): StubBucket;
  insertJob(row: StubJobRow): StubJobRow;
  reset(): void;
}

export function createSupabaseStub(options: SupabaseStubOptions = {}): SupabaseStub {
  const jobs = new Map<string, StubJobRow>();
  const projects: Row[] = [];
  const calls: StubCall[] = [];
  const transitions: { id: string; from: string; to: string; at: number }[] = [];
  const mutex = new Mutex();
  const buckets = new Map<string, StubBucket>();
  const supabaseUrl = (options.supabaseUrl ?? 'https://stub.supabase.test').replace(/\/+$/, '');

  const stub: SupabaseStub = {
    jobs,
    projects,
    calls,
    transitions,
    mutex,
    latencyMs: options.latencyMs ?? 0,
    strictSingleEmpty: options.strictSingleEmpty ?? false,
    supabaseUrl,

    rowsFor(table: string): Row[] {
      if (table === 'studio_render_jobs') return [...jobs.values()] as unknown as Row[];
      if (table === 'studio_projects') return projects;
      return [];
    },

    bucket(name: string): StubBucket {
      let b = buckets.get(name);
      if (!b) {
        b = new StubBucket(name, stub);
        buckets.set(name, b);
      }
      return b;
    },

    from(table: string): StubQueryBuilder<unknown> {
      return new StubQueryBuilder(stub, table);
    },

    storage: {
      from: (bucket: string) => stub.bucket(bucket),
    },

    insertJob(row: StubJobRow): StubJobRow {
      jobs.set(row.id, row);
      return row;
    },

    reset(): void {
      jobs.clear();
      projects.length = 0;
      calls.length = 0;
      transitions.length = 0;
      buckets.clear();
    },

    get client() {
      return {
        from: (table: string) => new StubQueryBuilder(stub, table),
        storage: {
          from: (bucket: string) => stub.bucket(bucket),
        },
      } as unknown as SupabaseClient;
    },
  };

  return stub;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Build a job row; defaults match the production schema (jsonb NOT NULL). */
export function makeJob(overrides: Partial<StubJobRow> & { id: string }): StubJobRow {
  const now = new Date().toISOString();
  return {
    id: overrides.id,
    user_id: overrides.user_id ?? '11111111-1111-1111-1111-111111111111',
    project_id: overrides.project_id ?? '22222222-2222-2222-2222-222222222222',
    status: overrides.status ?? 'queued',
    progress: overrides.progress ?? 0,
    output_url: overrides.output_url ?? null,
    captioned_output_url: overrides.captioned_output_url ?? null,
    error: overrides.error ?? null,
    worker_id: overrides.worker_id ?? null,
    project_snapshot:
      overrides.project_snapshot !== undefined
        ? overrides.project_snapshot
        : minimalProjectSnapshot(),
    render_settings: overrides.render_settings !== undefined ? overrides.render_settings : null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

/** A one-clip, one-second project — the smallest snapshot the worker accepts. */
export function minimalProjectSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: 'stub-project',
    title: 'Stub project',
    duration: 1,
    fps: 30,
    width: 1080,
    height: 1920,
    tracks: [
      {
        id: 'video-0',
        kind: 'video',
        name: 'Video',
        muted: false,
        volume: 1,
        clips: [
          {
            id: 'clip-1',
            assetUrl: 'https://cdn.example.com/stub-clip.mp4',
            assetKind: 'uploaded',
            start: 0,
            trimStart: 0,
            trimEnd: 1,
            volume: 1,
            fadeIn: 0,
            fadeOut: 0,
          },
        ],
      },
    ],
    captions: [],
    branding: {
      handle: '@stub',
      watermarkText: '@stub',
      watermarkPosition: 'top-left',
      accentColor: '#F59E0B',
      showProgressBar: true,
    },
    scenePlan: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
