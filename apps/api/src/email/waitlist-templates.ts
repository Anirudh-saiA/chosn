export interface WaitlistMailContext {
  name: string;
  interests: string[];
  shoes: string[];
  webUrl: string;
  instagramUrl: string;
  unsubscribeUrl: string;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

const wrap = (inner: string, unsubscribeUrl: string) =>
  `
<div style="background:#F6F5F1;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #ddd;padding:32px;">
    <p style="font-size:20px;font-weight:bold;color:#141414;margin:0 0 24px;letter-spacing:0.02em;">
      CH<span style="color:#C6963C;">O</span>SN
    </p>
    ${inner}
    <p style="font-size:13px;color:#999;margin:32px 0 0;">— Team CHOSN</p>
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#999;text-align:center;">
    You're getting this because you joined the CHOSN waitlist.
    <a href="${esc(unsubscribeUrl)}" style="color:#999;">Unsubscribe</a>
  </p>
</div>
`.trim();

const p = (html: string) => `<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 16px;">${html}</p>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0;"><a href="${esc(href)}" style="display:inline-block;background:#141414;color:#fff;text-decoration:none;padding:12px 22px;font-size:14px;font-family:Arial,sans-serif;">${esc(label)}</a></p>`;

export function welcomeMail(ctx: WaitlistMailContext): { subject: string; html: string; text: string } {
  const n = esc(firstName(ctx.name));
  const html = wrap(
    `
    <p style="font-size:16px;color:#141414;margin:0 0 16px;">You're in, ${n}.</p>
    ${p(`Thanks for joining the CHOSN waitlist. We compare sneaker prices across India so you stop overpaying — and you'll hear from us first when early access opens.`)}
    ${p(`Until then, the best way to stay close is Instagram — drop alerts, restock sightings and price-drop calls land there first.`)}
    ${button(ctx.instagramUrl, 'Follow us on Instagram')}
    ${p(`In a day or two we'll send you something tailored to the shoes you care about. Keep an eye out.`)}
  `,
    ctx.unsubscribeUrl,
  );
  const text = `You're in, ${firstName(ctx.name)}.\n\nThanks for joining the CHOSN waitlist. Follow us on Instagram for drops, restocks and price-drop calls: ${ctx.instagramUrl}\n\nUnsubscribe: ${ctx.unsubscribeUrl}`;
  return { subject: `${firstName(ctx.name)}, you're on the CHOSN waitlist`, html, text };
}

const INTEREST_BLOCKS: Record<string, { title: string; body: string; path: string; cta: string }> = {
  Jordan: {
    title: 'Jordan watch',
    body: 'Jordans move fast and prices swing hard between stores. We track every size so you buy at the real low, not the first listing.',
    path: '/sneakers?q=jordan',
    cta: 'See live Jordan prices',
  },
  Nike: {
    title: 'Nike watch',
    body: 'Dunks, Air Force, Pegasus — same shoe, very different prices across retailers. We line them up side by side.',
    path: '/sneakers?q=nike',
    cta: 'See live Nike prices',
  },
  Yeezy: {
    title: 'Yeezy watch',
    body: 'Yeezy stock is patchy and resale is wild. We show where it is actually in stock and at what price.',
    path: '/sneakers?q=yeezy',
    cta: 'See live Yeezy prices',
  },
  'Price alerts': {
    title: 'Price alerts',
    body: 'You asked for price alerts — when a pair you follow hits a new low, you will hear about it.',
    path: '/wishlist',
    cta: 'Start a wishlist',
  },
  'Drop news': {
    title: 'Drop news',
    body: 'Release dates, raffles and restock windows — all in one calendar so nothing slips past.',
    path: '/drops',
    cta: 'See upcoming drops',
  },
};

export function followupMail(ctx: WaitlistMailContext): { subject: string; html: string; text: string } {
  const n = esc(firstName(ctx.name));
  const shoe = ctx.shoes[0];

  const shoeBlock = shoe
    ? `${p(`You told us you're after <strong>${esc(shoe)}</strong>. That's now on our radar — we'll flag the best price and any restock the moment we see it.`)}
       ${button(`${ctx.webUrl}/sneakers?q=${encodeURIComponent(shoe)}`, `Check ${shoe} prices`)}`
    : '';

  const blocks = ctx.interests
    .map((i) => INTEREST_BLOCKS[i])
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .map(
      (b) =>
        `<p style="font-size:15px;color:#141414;margin:20px 0 4px;"><strong>${esc(b.title)}</strong></p>
         ${p(esc(b.body))}
         <p style="margin:0 0 8px;"><a href="${esc(ctx.webUrl + b.path)}" style="color:#C6963C;font-size:14px;">${esc(b.cta)} →</a></p>`,
    )
    .join('');

  const fallback =
    !shoe && !blocks
      ? `${p('Here is a quick taste of what CHOSN does: every sneaker, every major Indian store, one price comparison.')}
         ${button(`${ctx.webUrl}/sneakers`, 'Browse sneakers')}`
      : '';

  const html = wrap(
    `
    <p style="font-size:16px;color:#141414;margin:0 0 16px;">${n}, a little something for your sneaker list.</p>
    ${shoeBlock}${blocks}${fallback}
    ${p(`Questions, a shoe we should track, or a store we're missing? Just reply to this email — a human reads it.`)}
    ${p(`And if you haven't yet: <a href="${esc(ctx.instagramUrl)}" style="color:#C6963C;">follow us on Instagram</a> so you catch drops live.`)}
  `,
    ctx.unsubscribeUrl,
  );

  const text = `${firstName(ctx.name)}, a little something for your sneaker list.\n${shoe ? `\nYou're after: ${shoe}\n` : ''}\nBrowse prices: ${ctx.webUrl}/sneakers\nInstagram: ${ctx.instagramUrl}\n\nUnsubscribe: ${ctx.unsubscribeUrl}`;
  return {
    subject: shoe ? `${firstName(ctx.name)}, we're watching ${shoe} for you` : `${firstName(ctx.name)}, your CHOSN sneaker briefing`,
    html,
    text,
  };
}
