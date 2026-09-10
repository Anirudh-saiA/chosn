'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import {
  createPost,
  resolveVariantId,
  searchSneakers,
  uploadPostImage,
  type ChecklistItem,
  type PostType,
  type SearchResultItem,
} from '@/lib/community';
import { fetchDropsList, type DropListItem } from '@/lib/drops';

const POST_TYPES: { value: PostType; label: string; hint: string }[] = [
  { value: 'price_check', label: 'Price Check', hint: 'Is this worth it right now?' },
  { value: 'cop_or_drop', label: 'Cop or Drop', hint: 'Put it to a vote.' },
  { value: 'legit_check', label: 'Legit Check', hint: 'Get eyes on it before you buy or sell.' },
  { value: 'drop_talk', label: 'Drop Talk', hint: 'Talk about an upcoming or live drop.' },
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'box_label', label: 'Box label' },
  { id: 'stitching', label: 'Stitching' },
  { id: 'insole_stamp', label: 'Insole stamp' },
  { id: 'size_tag', label: 'Size tag' },
];

/** `useSearchParams()` (reading the ?type=/&dropEventId= preset from the drop page's CTA) needs a Suspense boundary — see the default export below. */
function NewPostForm() {
  const { data: session } = useSession();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [postType, setPostType] = useState<PostType>((searchParams.get('type') as PostType) ?? 'price_check');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // price_check / cop_or_drop — sneaker search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selected, setSelected] = useState<SearchResultItem | null>(null);

  // legit_check — checklist + post-create image upload
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [uploadedFor, setUploadedFor] = useState<Set<string>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

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
      return;
    }
    const handle = setTimeout(() => searchSneakers(query).then(setResults), 250);
    return () => clearTimeout(handle);
  }, [query, postType]);

  if (!apiToken) {
    return (
      <main>
        <Masthead />
        <div className="mx-auto max-w-xl px-6 py-14 text-center">
          <p className="text-body text-text-soft">Sign in to post to the community.</p>
        </div>
        <SiteFooter />
      </main>
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

  async function submit() {
    setError(null);
    if (postType === 'price_check' || postType === 'cop_or_drop') {
      if (!selected) return setError('Search and pick a sneaker first.');
    }
    if (postType === 'legit_check' && checklist.some((c) => !c.label.trim())) {
      return setError('Every checklist item needs a label — remove any blank ones.');
    }
    if (postType === 'drop_talk' && !dropEventId) {
      return setError('Pick which drop this is about.');
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
      setUploadedFor((prev) => new Set(prev).add(itemId));
    } else {
      // A rejection is a real, meaningful outcome now (oversized, wrong
      // type, or flagged by review) — the previous version of this
      // handler silently dropped it, leaving someone staring at a file
      // input that just... didn't do anything.
      setUploadErrors((prev) => ({ ...prev, [itemId]: result.message }));
    }
  }

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-xl px-6 py-10 lg:py-14">
        <p className="font-mono text-ui-label uppercase tracking-[0.06em] text-text-faint">Community</p>
        <h1 className="mt-1 font-display text-display-section font-semibold text-text">New post</h1>

        {createdPostId ? (
          <div className="mt-8">
            <p className="text-body text-text-soft">
              Post created — add a photo for each checklist item, then head to the feed.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {checklist.map((item) => (
                <li key={item.id} className="flex flex-col gap-1.5 border border-moss/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body text-text">{item.label}</span>
                    {uploadedFor.has(item.id) ? (
                      <span className="font-mono text-meta text-signal">Uploaded</span>
                    ) : (
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={`Photo for ${item.label}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(item.id, file);
                        }}
                        className="font-mono text-meta text-text-faint"
                      />
                    )}
                  </div>
                  {uploadErrors[item.id] && (
                    <p role="alert" className="font-mono text-meta text-rust">
                      {uploadErrors[item.id]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => router.push(`/community/${createdPostId}`)}
              className="mt-6 border border-brass bg-brass px-5 py-2.5 font-mono text-ui-label font-semibold text-vault hover:bg-brass/90"
            >
              Done — view post
            </button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPostType(t.value)}
                  className={`border px-3 py-2.5 text-left transition-colors duration-150 ${
                    postType === t.value ? 'border-brass bg-brass/10' : 'border-moss/25 hover:border-moss'
                  }`}
                >
                  <p className="font-mono text-ui-label font-semibold text-text">{t.label}</p>
                  <p className="mt-0.5 text-meta text-text-faint">{t.hint}</p>
                </button>
              ))}
            </div>

            {(postType === 'price_check' || postType === 'cop_or_drop') && (
              <div>
                <label className="font-mono text-ui-label text-text-faint">Sneaker</label>
                {selected ? (
                  <div className="mt-1.5 flex items-center justify-between border border-moss/30 bg-vault-raised px-3 py-2">
                    <span className="text-body text-text">
                      {selected.brand} {selected.model} — {selected.colorway}
                    </span>
                    <button type="button" onClick={() => setSelected(null)} className="font-mono text-meta text-text-faint hover:text-text">
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search brand, model, style code…"
                      className="mt-1.5 w-full border border-moss/30 bg-vault-raised px-3 py-2 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
                    />
                    {results.length > 0 && (
                      <ul className="mt-1 border border-moss/20">
                        {results.map((r) => (
                          <li key={`${r.styleCode}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelected(r);
                                setResults([]);
                                setQuery('');
                              }}
                              className="block w-full px-3 py-2 text-left text-body text-text hover:bg-vault"
                            >
                              {r.brand} {r.model} — {r.colorway}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            {postType === 'drop_talk' && (
              <div>
                <label className="font-mono text-ui-label text-text-faint">Drop</label>
                {presetDropEventId ? (
                  <p className="mt-1.5 text-body text-text">Talking about this drop</p>
                ) : (
                  <select
                    value={dropEventId}
                    onChange={(e) => setDropEventId(e.target.value)}
                    className="mt-1.5 w-full border border-moss/30 bg-vault-raised px-3 py-2 text-body text-text focus:border-brass focus:outline-none"
                  >
                    <option value="">Select a drop…</option>
                    {drops.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.sneaker.brand} {d.sneaker.model} — {d.sneaker.colorway}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {(postType === 'cop_or_drop' || postType === 'legit_check' || postType === 'drop_talk') && (
              <div>
                <label className="font-mono text-ui-label text-text-faint">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className="mt-1.5 w-full border border-moss/30 bg-vault-raised px-3 py-2 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="font-mono text-ui-label text-text-faint">
                {postType === 'legit_check' ? 'Context (optional)' : 'Body'}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={5000}
                className="mt-1.5 w-full border border-moss/30 bg-vault-raised px-3 py-2 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
              />
            </div>

            {postType === 'legit_check' && (
              <div>
                <label className="font-mono text-ui-label text-text-faint">Checklist</label>
                <p className="mt-1 text-meta text-text-faint">
                  What should the community check? Configurable per post — a Dunk's checklist isn't a Yeezy's.
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {checklist.map((item, i) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => updateChecklistItem(i, e.target.value)}
                        placeholder="e.g. Box label"
                        className="flex-1 border border-moss/30 bg-vault-raised px-3 py-1.5 text-body text-text placeholder:text-text-faint focus:border-brass focus:outline-none"
                      />
                      <button type="button" onClick={() => removeChecklistItem(i)} className="font-mono text-meta text-text-faint hover:text-rust">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={addChecklistItem} className="mt-2 font-mono text-meta text-brass hover:underline">
                  + Add checklist item
                </button>
              </div>
            )}

            {error && <p className="font-mono text-meta text-rust">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="self-start border border-brass bg-brass px-6 py-2.5 font-mono text-ui-label font-semibold text-vault hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={null}>
      <NewPostForm />
    </Suspense>
  );
}
