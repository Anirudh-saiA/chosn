'use client';

import Link from 'next/link';
import { Suspense, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  UploadCloud,
  X,
} from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { SneakerArt } from '@/components/ui/SneakerArt';
import { PostCard } from '@/components/community/PostCard';
import { POST_TYPE_META } from '@/components/community/meta';
import { buttonVariantClass } from '@chosn/ui';
import { paletteFor } from '@/lib/sneaker/palette';
import {
  createPost,
  resolveVariantId,
  searchSneakers,
  uploadPostImage,
  type ChecklistItem,
  type Post,
  type PostType,
  type SearchResultItem,
} from '@/lib/community';
import { fetchDropsList, type DropListItem } from '@/lib/drops';

// Legit Check hidden from creation for this version (product decision,
// not a removal) — it needs real object storage for photo uploads
// (Day 26), and that was deliberately deferred (Cloudflare R2, still
// pending real credentials as of this change). Nothing backend-side
// changed: the post type, its endpoints, and every rendering component
// still handle a legit_check post correctly if one exists — this only
// closes the one entry point that would let a user start a flow that
// currently can't accept a photo. Re-add the POST_TYPES entry once R2
// is live to bring it back with zero other changes needed.
const POST_TYPES: { value: PostType; label: string; hint: string }[] = [
  { value: 'price_check', label: 'Price Check', hint: 'Is this worth it right now?' },
  { value: 'cop_or_drop', label: 'Cop or Drop', hint: 'Put it to a vote.' },
  { value: 'drop_talk', label: 'Drop Talk', hint: 'Talk about an upcoming or live drop.' },
];

const VISIBLE_POST_TYPES = new Set(POST_TYPES.map((t) => t.value));

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'box_label', label: 'Box label' },
  { id: 'stitching', label: 'Stitching' },
  { id: 'insole_stamp', label: 'Insole stamp' },
  { id: 'size_tag', label: 'Size tag' },
];

const FIELD =
  'w-full border border-text/15 bg-vault-deep/70 px-4 py-3 font-sans text-body text-text outline-none transition-all duration-200 placeholder:text-text-faint hover:border-text/30 focus-visible:border-ice focus-visible:shadow-[0_0_0_3px_rgba(143,214,255,.18)]';
const FIELD_ERR = 'border-rust/70 hover:border-rust focus-visible:border-rust';

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center border border-brass/40 bg-brass/10 font-mono text-ui-label font-bold text-brass-bright">
          {n}
        </span>
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, children }: { id: string; children?: string | false | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-center gap-1.5 font-mono text-meta text-rust">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** `useSearchParams()` (reading the ?type=/&dropEventId= preset from the drop page's CTA) needs a Suspense boundary — see the default export below. */
function NewPostForm() {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = useId();

  // Guards the ?type= URL param the same way the selector itself is
  // hidden — a direct link to ?type=legit_check shouldn't bypass this.
  const presetType = searchParams.get('type') as PostType | null;
  const [postType, setPostType] = useState<PostType>(
    presetType && VISIBLE_POST_TYPES.has(presetType) ? presetType : 'price_check',
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // price_check / cop_or_drop — sneaker search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selected, setSelected] = useState<SearchResultItem | null>(null);

  // legit_check — checklist + post-create image upload
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [uploadedFor, setUploadedFor] = useState<Set<string>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState<string | null>(null);

  // drop_talk
  const presetDropEventId = searchParams.get('dropEventId');
  const [drops, setDrops] = useState<DropListItem[]>([]);
  const [dropEventId, setDropEventId] = useState(presetDropEventId ?? '');

  useEffect(() => {
    if (postType !== 'drop_talk' || presetDropEventId) return;
    fetchDropsList({ status: ['upcoming', 'live'] }).then(setDrops);
  }, [postType, presetDropEventId]);

  useEffect(() => {
    if ((postType !== 'price_check' && postType !== 'cop_or_drop') || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(
      () =>
        searchSneakers(query).then((r) => {
          setResults(r);
          setActiveIdx(-1);
          setSearching(false);
        }),
      250,
    );
    return () => clearTimeout(handle);
  }, [query, postType]);

  const needsSneaker = postType === 'price_check' || postType === 'cop_or_drop';
  const showTitle = postType === 'cop_or_drop' || postType === 'legit_check' || postType === 'drop_talk';

  const errors = {
    sneaker: needsSneaker && !selected ? 'Search and pick a sneaker first.' : null,
    checklist:
      postType === 'legit_check' && checklist.some((c) => !c.label.trim())
        ? 'Every checklist item needs a label — remove any blank ones.'
        : null,
    drop: postType === 'drop_talk' && !dropEventId ? 'Pick which drop this is about.' : null,
  };
  const firstError = errors.sneaker ?? errors.checklist ?? errors.drop;

  if (!apiToken) {
    return (
      <PageShell width="3xl">
        <EmptyPanel
          icon={<Lock className="h-6 w-6" aria-hidden />}
          title="Sign in to post"
          action={
            <Link href="/login" className={buttonVariantClass('primary')}>
              Sign in
            </Link>
          }
        >
          Posting to the community needs an account so your reputation follows you.
        </EmptyPanel>
      </PageShell>
    );
  }

  function updateChecklistItem(index: number, label: string) {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  }
  function addChecklistItem() {
    setChecklist((prev) => [...prev, { id: `item_${prev.length}_${Date.now()}`, label: '' }]);
  }
  function removeChecklistItem(index: number) {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  }

  function pickSneaker(r: SearchResultItem) {
    setSelected(r);
    setResults([]);
    setQuery('');
  }

  function onComboKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      e.preventDefault();
      pickSneaker(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setResults([]);
    }
  }

  async function submit() {
    setError(null);
    if (firstError) {
      setAttempted(true);
      return;
    }

    setSubmitting(true);
    let sneakerVariantId: string | undefined;
    if (selected) {
      const id = await resolveVariantId(selected.styleCode, selected.defaultSize);
      if (!id) {
        setSubmitting(false);
        return setError('Could not resolve that sneaker — try a different result.');
      }
      sneakerVariantId = id;
    }

    const result = await createPost(apiToken!, {
      postType,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      sneakerVariantId,
      dropEventId: postType === 'drop_talk' ? dropEventId : undefined,
      legitCheckChecklist: postType === 'legit_check' ? checklist : undefined,
    });
    setSubmitting(false);

    if (!result.ok) return setError(result.message);
    if (postType === 'legit_check') {
      setCreatedPostId(result.id); // stay on page for image uploads
    } else {
      router.push(`/community/${result.id}`);
    }
  }

  async function handleUpload(itemId: string, file: File) {
    if (!createdPostId) return;
    setUploadErrors((prev) => ({ ...prev, [itemId]: '' }));
    const result = await uploadPostImage(apiToken!, createdPostId, file, itemId);
    if (result.ok) {
      setPreviews((prev) => ({ ...prev, [itemId]: URL.createObjectURL(file) }));
      setUploadedFor((prev) => new Set(prev).add(itemId));
    } else {
      // A rejection is a real, meaningful outcome now (oversized, wrong
      // type, or flagged by review) — surface it next to the field.
      setUploadErrors((prev) => ({ ...prev, [itemId]: result.message }));
    }
  }

  // ---- live preview: a synthetic Post rendered through the real PostCard ----
  const dropChoice = drops.find((d) => d.id === dropEventId);
  const user = session?.user as unknown as { id?: string; name?: string | null } | undefined;
  const previewSneaker = selected ?? (dropChoice ? dropChoice.sneaker : null);
  const previewPost: Post = {
    id: 'preview',
    postType,
    title: title.trim() || null,
    body: body.trim() || null,
    authorUserId: user?.id ?? 'you',
    authorDisplayName: user?.name ?? 'You',
    authorAvatarSeed: user?.id ?? user?.name ?? 'you',
    authorReputationScore: 0,
    createdAt: new Date().toISOString(),
    commentCount: 0,
    voteScore: 0,
    viewerVote: null,
    sneaker: previewSneaker
      ? {
          styleCode: 'styleCode' in previewSneaker ? previewSneaker.styleCode : '',
          brand: previewSneaker.brand,
          model: previewSneaker.model,
          colorway: previewSneaker.colorway,
        }
      : null,
    variant: null,
    marketIntelligence: null,
    pollResults: postType === 'cop_or_drop' ? { cop: 0, drop: 0, total: 0, viewerChoice: null } : null,
    legitCheckChecklist: postType === 'legit_check' ? checklist.filter((c) => c.label.trim()) : null,
    images: null,
    dropEvent:
      postType === 'drop_talk' && dropEventId
        ? { id: dropEventId, releaseDate: dropChoice?.releaseDate ?? '—', status: dropChoice?.status ?? 'upcoming' }
        : null,
  };
  const previewEmpty = !title.trim() && !body.trim() && !previewSneaker;

  return (
    <PageShell width="6xl">
      <PageHeader
        eyebrow="Community"
        title={
          <>
            New <span className="text-brass-gradient">post.</span>
          </>
        }
        description="Pick a format, attach a pair, say your piece. Your reputation badge goes with it."
      />

      {createdPostId ? (
        <div className="mx-auto max-w-3xl">
          <div className="panel ticks p-6 sm:p-8">
            <p className="flex items-center gap-2 font-mono text-ui-label font-semibold text-signal">
              <Check className="h-4 w-4" aria-hidden /> POST CREATED
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-text">Now add a photo for each checklist item</h2>
            <p className="mt-2 text-text-soft">JPG, PNG or WebP. Drop a file on a slot or click it to browse.</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {checklist.map((item) => {
                const done = uploadedFor.has(item.id);
                const inputId = `${uid}-up-${item.id}`;
                return (
                  <li key={item.id}>
                    <label
                      htmlFor={inputId}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(item.id);
                      }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(null);
                        const file = e.dataTransfer.files?.[0];
                        if (file && !done) handleUpload(item.id, file);
                      }}
                      className={`group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden border border-dashed px-3 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brass-bright ${
                        done
                          ? 'cursor-default border-signal/50 bg-signal/[0.05]'
                          : dragOver === item.id
                            ? 'border-brass bg-brass/10'
                            : 'border-text/25 bg-vault-deep/60 hover:border-brass/60'
                      }`}
                    >
                      {previews[item.id] ? (
                        <img src={previews[item.id]} alt={`Uploaded photo: ${item.label}`} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <UploadCloud className="h-6 w-6 text-brass-bright" aria-hidden />
                      )}
                      <span
                        className={`relative font-mono text-meta font-semibold ${previews[item.id] ? 'bg-black/70 px-2 py-1 text-text' : 'text-text'}`}
                      >
                        {item.label}
                        {done && <span className="ml-2 text-signal">✓ Uploaded</span>}
                      </span>
                      {!done && <span className="relative font-mono text-[0.65rem] text-text-soft">Drop image or click to browse</span>}
                      <input
                        id={inputId}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={done}
                        aria-label={`Photo for ${item.label}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(item.id, file);
                        }}
                        className="sr-only"
                      />
                    </label>
                    {uploadErrors[item.id] && <FieldError id={`${inputId}-err`}>{uploadErrors[item.id]}</FieldError>}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => router.push(`/community/${createdPostId}`)}
              className={`${buttonVariantClass('primary')} mt-8`}
            >
              Done — view post
            </button>
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {/* 01 — type */}
            <Step n="01" title="What kind of post?">
              <fieldset>
                <legend className="sr-only">Post type</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {POST_TYPES.map((t) => {
                    const Icon = POST_TYPE_META[t.value].icon;
                    const on = postType === t.value;
                    return (
                      <label
                        key={t.value}
                        className={`relative flex cursor-pointer flex-col gap-3 border p-4 transition-all duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brass-bright ${
                          on ? 'border-brass/70 bg-brass/[0.09] shadow-glow-brass' : 'border-text/15 bg-vault-deep/50 hover:border-text/35'
                        }`}
                      >
                        <input
                          type="radio"
                          name="postType"
                          value={t.value}
                          checked={on}
                          onChange={() => setPostType(t.value)}
                          className="sr-only"
                        />
                        <span className="flex items-start justify-between">
                          <span
                            className={`flex h-10 w-10 items-center justify-center border ${
                              on ? 'border-brass/60 bg-brass/15 text-brass-bright' : 'border-text/15 text-text-soft'
                            }`}
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          {on && <Check className="h-4 w-4 text-brass-bright" aria-hidden />}
                        </span>
                        <span>
                          <span className="block font-display text-lg font-bold leading-tight text-text">{t.label}</span>
                          <span className="mt-1 block text-meta text-text-soft">{t.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Step>

            {/* 02 — subject */}
            {needsSneaker && (
              <Step n="02" title="Which pair?">
                <label htmlFor={`${uid}-sneaker`} className="mb-2 block font-mono text-ui-label font-semibold text-text-soft">
                  Sneaker
                </label>
                {selected ? (
                  <div className="flex items-center gap-4 border border-brass/40 bg-brass/[0.05] p-3">
                    <div
                      className="flex h-16 w-24 shrink-0 items-center justify-center border border-text/[0.06]"
                      style={{
                        background: `radial-gradient(75% 90% at 50% 45%, ${paletteFor(selected.colorway, selected.brand).glow}38, transparent 80%), #0A0F0C`,
                      }}
                    >
                      <SneakerArt colorway={selected.colorway} brand={selected.brand} className="h-full w-full p-1" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-brass">{selected.brand}</p>
                      <p className="truncate font-display text-lg font-semibold text-text">{selected.model}</p>
                      <p className="truncate text-meta text-text-soft">
                        {selected.colorway} · <span className="font-mono">{selected.styleCode}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="inline-flex min-h-11 items-center gap-1.5 border border-text/15 px-3 font-mono text-meta text-text-soft hover:border-brass/60 hover:text-text"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-soft" aria-hidden />
                    <input
                      id={`${uid}-sneaker`}
                      role="combobox"
                      aria-expanded={results.length > 0}
                      aria-controls={`${uid}-listbox`}
                      aria-autocomplete="list"
                      aria-activedescendant={activeIdx >= 0 ? `${uid}-opt-${activeIdx}` : undefined}
                      aria-invalid={attempted && !!errors.sneaker}
                      aria-describedby={attempted && errors.sneaker ? `${uid}-sneaker-err` : undefined}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onComboKey}
                      autoComplete="off"
                      placeholder="Search brand, model, style code…"
                      className={`${FIELD} pl-11 ${attempted && errors.sneaker ? FIELD_ERR : ''}`}
                    />
                    {searching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brass" aria-hidden />}
                    {results.length > 0 && (
                      <ul
                        id={`${uid}-listbox`}
                        role="listbox"
                        aria-label="Sneaker results"
                        className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto border border-text/15 bg-vault-raised shadow-lift"
                      >
                        {results.map((r, i) => {
                          const p = paletteFor(r.colorway, r.brand);
                          return (
                            <li
                              key={r.styleCode}
                              id={`${uid}-opt-${i}`}
                              role="option"
                              aria-selected={i === activeIdx}
                              onMouseEnter={() => setActiveIdx(i)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                pickSneaker(r);
                              }}
                              className={`flex min-h-14 cursor-pointer items-center gap-3 border-b border-text/[0.06] px-3 py-2 last:border-b-0 ${
                                i === activeIdx ? 'bg-vault-high' : ''
                              }`}
                            >
                              <span
                                className="flex h-11 w-16 shrink-0 items-center justify-center border border-text/[0.06]"
                                style={{ background: `radial-gradient(80% 90% at 50% 45%, ${p.glow}38, transparent 80%), #0A0F0C` }}
                              >
                                <SneakerArt colorway={r.colorway} brand={r.brand} palette={p} className="h-full w-full p-0.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-ui-label font-semibold text-text">
                                  {r.brand} {r.model}
                                </span>
                                <span className="block truncate text-meta text-text-soft">
                                  {r.colorway} · <span className="font-mono">{r.styleCode}</span>
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!searching && query.trim() && results.length === 0 && (
                      <p className="mt-2 font-mono text-meta text-text-soft" role="status">
                        No pairs match “{query.trim()}”.
                      </p>
                    )}
                  </div>
                )}
                <FieldError id={`${uid}-sneaker-err`}>{attempted && errors.sneaker}</FieldError>
              </Step>
            )}

            {postType === 'drop_talk' && (
              <Step n="02" title="Which drop?">
                <label htmlFor={`${uid}-drop`} className="mb-2 block font-mono text-ui-label font-semibold text-text-soft">
                  Drop
                </label>
                {presetDropEventId ? (
                  <p className="border border-brass/40 bg-brass/[0.05] px-4 py-3 text-body text-text">Talking about this drop</p>
                ) : (
                  <select
                    id={`${uid}-drop`}
                    value={dropEventId}
                    onChange={(e) => setDropEventId(e.target.value)}
                    aria-invalid={attempted && !!errors.drop}
                    aria-describedby={attempted && errors.drop ? `${uid}-drop-err` : undefined}
                    className={`${FIELD} ${attempted && errors.drop ? FIELD_ERR : ''}`}
                  >
                    <option value="">Select a drop…</option>
                    {drops.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.sneaker.brand} {d.sneaker.model} — {d.sneaker.colorway}
                      </option>
                    ))}
                  </select>
                )}
                <FieldError id={`${uid}-drop-err`}>{attempted && errors.drop}</FieldError>
              </Step>
            )}

            {/* 03 — words */}
            <Step n={postType === 'legit_check' ? '02' : '03'} title="Say your piece">
              <div className="flex flex-col gap-5">
                {showTitle && (
                  <div>
                    <div className="mb-2 flex items-baseline justify-between">
                      <label htmlFor={`${uid}-title`} className="font-mono text-ui-label font-semibold text-text-soft">
                        Title
                      </label>
                      <span className="font-mono text-meta text-text-soft">{title.length}/200</span>
                    </div>
                    <input
                      id={`${uid}-title`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={200}
                      placeholder={postType === 'cop_or_drop' ? 'e.g. Panda Dunk at ₹10,795 — still a cop?' : 'Give it a headline'}
                      className={FIELD}
                    />
                  </div>
                )}
                <div>
                  <div className="mb-2 flex items-baseline justify-between">
                    <label htmlFor={`${uid}-body`} className="font-mono text-ui-label font-semibold text-text-soft">
                      {postType === 'legit_check' ? 'Context (optional)' : 'Body'}
                    </label>
                    <span className="font-mono text-meta text-text-soft">{body.length}/5000</span>
                  </div>
                  <textarea
                    id={`${uid}-body`}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Share the details — price, size, where you saw it."
                    className={FIELD}
                  />
                </div>
              </div>
            </Step>

            {/* Poll (fixed two-way) */}
            {postType === 'cop_or_drop' && (
              <Step n="04" title="The poll">
                <p className="mb-4 text-meta text-text-soft">
                  Every Cop or Drop is a fixed two-way poll. Voters pick a side and the split updates live.
                </p>
                <div className="grid grid-cols-2 gap-3" aria-label="Poll options">
                  <div className="flex items-center justify-center gap-2 border border-signal/35 bg-signal/[0.05] py-3 font-sans text-ui-label font-semibold uppercase tracking-[0.08em] text-signal">
                    <ThumbsUp className="h-4 w-4" aria-hidden /> Cop
                  </div>
                  <div className="flex items-center justify-center gap-2 border border-rust/35 bg-rust/[0.05] py-3 font-sans text-ui-label font-semibold uppercase tracking-[0.08em] text-rust">
                    <ThumbsDown className="h-4 w-4" aria-hidden /> Drop
                  </div>
                </div>
              </Step>
            )}

            {/* Legit-check checklist */}
            {postType === 'legit_check' && (
              <Step n="03" title="Checklist">
                <p className="mb-3 text-meta text-text-soft">
                  What should the community check? Configurable per post — a Dunk&apos;s checklist isn&apos;t a Yeezy&apos;s.
                </p>
                <ul className="flex flex-col gap-2">
                  {checklist.map((item, i) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <label htmlFor={`${uid}-ck-${i}`} className="sr-only">
                        Checklist item {i + 1}
                      </label>
                      <input
                        id={`${uid}-ck-${i}`}
                        value={item.label}
                        onChange={(e) => updateChecklistItem(i, e.target.value)}
                        placeholder="e.g. Box label"
                        aria-invalid={attempted && !item.label.trim()}
                        className={`${FIELD} !py-2 ${attempted && !item.label.trim() ? FIELD_ERR : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(i)}
                        aria-label={`Remove checklist item ${i + 1}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-text/15 text-text-soft hover:border-rust/60 hover:text-rust"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
                <FieldError id={`${uid}-ck-err`}>{attempted && errors.checklist}</FieldError>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-mono text-meta font-semibold text-brass-bright hover:underline"
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add checklist item
                </button>
              </Step>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={submitting} className={buttonVariantClass('primary', 'px-8 py-3.5')}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Posting…
                  </>
                ) : (
                  'Post to the community'
                )}
              </button>
              {attempted && firstError && (
                <p role="alert" className="flex items-center gap-1.5 font-mono text-meta text-rust">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden /> Fix the highlighted field to continue.
                </p>
              )}
              {error && (
                <p role="alert" className="flex items-center gap-1.5 font-mono text-meta text-rust">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {error}
                </p>
              )}
            </div>
          </form>

          {/* live preview */}
          <aside aria-label="Live preview" className="lg:sticky lg:top-24">
            <p className="eyebrow mb-3 flex items-center gap-2">
              <span className="live-dot text-brass" aria-hidden /> Live preview
            </p>
            {previewEmpty && (
              <p className="mb-3 text-meta text-text-soft">Start typing or pick a pair — your post takes shape here.</p>
            )}
            <PostCard post={previewPost} preview />
          </aside>
        </div>
      )}
    </PageShell>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={null}>
      <NewPostForm />
    </Suspense>
  );
}
