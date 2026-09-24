import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageShell } from '@/components/ui/PageShell';
import { PostCard } from '@/components/community/PostCard';
import { CommentThread } from '@/components/community/CommentThread';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { auth } from '@/auth';
import { getChatRoomByDrop } from '@/lib/chat';
import { getPost, listComments } from '@/lib/community';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: 'Not found' };
  return { title: `${post.title ?? 'Community post'}` };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;

  const [post, comments] = await Promise.all([getPost(id, apiToken), listComments(id)]);
  if (!post) notFound();

  // Drop Talk threads get the drop's live chat room alongside the comments.
  const chatRoom = post.dropEvent ? await getChatRoomByDrop(post.dropEvent.id, { cache: 'no-store' }) : null;

  return (
    <PageShell width="4xl">
      <Link
        href="/community"
        className="mb-6 inline-flex min-h-11 items-center gap-2 font-mono text-ui-label text-text-soft transition-colors hover:text-brass-bright"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to the feed
      </Link>

      <PostCard post={post} variant="detail" />

      {chatRoom && (
        <div className="mt-8">
          <ChatRoom room={chatRoom} />
        </div>
      )}

      <div className="mt-12">
        <CommentThread postId={post.id} initialComments={comments} />
      </div>
    </PageShell>
  );
}
