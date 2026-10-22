import { simpleParser } from 'mailparser';
import { matchSender, isGoogleAlert, alertRows, newsletterRow, isNewsy, unwrapGoogleUrl, senderDomain } from './fetch-email-news.ts';
const eq=(n:string,a:unknown,b:unknown)=>{const ok=JSON.stringify(a)===JSON.stringify(b);console.log(ok?'PASS':'FAIL',n, ok?'':JSON.stringify({a,b}));if(!ok)process.exitCode=1};
const alert=`From: Google Alerts <googlealerts-noreply@google.com>
To: x@gmail.com
Subject: Google Alert - sneaker india
Message-ID: <a1@google.com>
Date: Tue, 20 Oct 2026 10:00:00 +0000
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<html><body><a href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://www.example.com/news/comet-drop&amp;ct=ga&amp;cd=ABC">Comet drops a <b>new</b> sneaker with UNO</a>
<a href="https://www.google.com/url?rct=j&amp;sa=t&amp;url=https://www.example.com/news/comet-drop&amp;ct=ga">Comet drops a new sneaker with UNO</a>
<a href="https://www.google.com/alerts/feedback?x=1">Flag as irrelevant and more text</a>
<a href="https://www.google.com/url?sa=t&amp;url=http://insecure.example/a">An insecure http result should be skipped</a>
<a href="https://www.google.com/url?sa=t&amp;url=https://www.hindustantimes.com/lifestyle/x">Short</a></body></html>`;
const m=await simpleParser(alert);
eq('alert sender',isGoogleAlert(m.from!.value[0]!.address!),true);
const rows=alertRows(m.html as string,m.date!);
eq('alert rows count',rows.length,1);
eq('alert url unwrapped',rows[0]?.url,'https://www.example.com/news/comet-drop');
eq('alert title plain',rows[0]?.title,'Comet drops a new sneaker with UNO');
eq('alert source host',rows[0]?.source,'example.com');
const nl=`From: Superkicks <hello@mail.superkicks.in>
Subject: JUST LANDED: Air Jordan 12 "Fireside" drop this Friday
Message-ID: <n1@mail.superkicks.in>
Date: Mon, 19 Oct 2026 08:00:00 +0000
Content-Type: text/plain; charset=utf-8

Hey! The Air Jordan 12 Fireside arrives Friday at 10 AM IST in all stores. View this email in your browser https://track.example/u?token=SECRET Unsubscribe`;
const n=await simpleParser(nl);
const s=matchSender(n.from!.value[0]!.address!);
eq('sender matched via subdomain',s?.name,'Superkicks');
const r=newsletterRow(s!,n.messageId!,n.subject!,n.text!,n.date!);
eq('newsletter kept',!!r,true);
eq('no token leaked in url',/SECRET|track\.example/.test(JSON.stringify(r)),false);
eq('link is public page',r?.url.startsWith('https://www.superkicks.in/#mail-'),true);
eq('excerpt <=180',(r?.body.length??0)<=180,true);
eq('promo skipped',isNewsy('FLAT 40% OFF sitewide sale'),false);
eq('promo with drop word kept',isNewsy('Sale ends, new Dunk drop inside'),true);
eq('unknown sender',matchSender('spam@evil-superkicks.in.example.com'),null);
eq('lookalike domain not matched',matchSender('a@notsuperkicks.in'),null);
eq('unwrap rejects non-google',unwrapGoogleUrl('https://evil.example/url?url=https://x.com'),null);
eq('domain',senderDomain('A@B.Com'),'b.com');
import { authenticated } from './fetch-email-news.ts';
eq('auth dkim pass',authenticated('mx.google.com; dkim=pass header.i=@superkicks.in; spf=pass'),true);
eq('auth fail',authenticated('mx.google.com; dkim=fail; spf=softfail'),false);
eq('auth missing',authenticated(''),false);
