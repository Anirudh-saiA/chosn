import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Masthead } from '@/components/Masthead';
import { SiteFooter } from '@/components/SiteFooter';
import { PostCard } from '@/components/community/PostCard';
import { CommentThread } from '@/components/community/CommentThread';
import { auth } from '@/auth';
import { getPost, listComments } from '@/lib/community';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: 'Not found | CHOSN' };
  return { title: `${post.title ?? 'Community post'} | CHOSN` };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const apiToken = (session as unknown as { apiToken?: string } | null)?.apiToken;

  const [post, comments] = await Promise.all([getPost(id, apiToken), listComments(id)]);
  if (!post) notFound();

  return (
    <main>
      <Masthead />
      <div className="mx-auto max-w-2xl px-6 py-10 lg:py-14">
        <PostCard post={post} />
        <div className="mt-8">
          <CommentThread postId={post.id} initialComments={comments} />
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
