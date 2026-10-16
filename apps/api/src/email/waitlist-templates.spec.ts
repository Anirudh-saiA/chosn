import { describe, expect, it } from 'vitest';
import { followupMail, welcomeMail, type WaitlistMailContext } from './waitlist-templates';

const base: WaitlistMailContext = {
  name: 'Ravi Kumar',
  interests: ['Jordan', 'Drop news'],
  shoes: ['Jordan 4 Military Blue'],
  webUrl: 'https://chosn.app',
  instagramUrl: 'https://instagram.com/chosn',
  unsubscribeUrl: 'https://api.chosn.app/waitlist/unsubscribe?token=abc',
};

describe('waitlist mails', () => {
  it('welcome greets by first name and links Instagram + unsubscribe', () => {
    const m = welcomeMail(base);
    expect(m.subject).toContain('Ravi');
    expect(m.html).toContain('https://instagram.com/chosn');
    expect(m.html).toContain('unsubscribe?token=abc');
  });

  it('follow-up is personalised by shoe and interest', () => {
    const m = followupMail(base);
    expect(m.subject).toContain('Jordan 4 Military Blue');
    expect(m.html).toContain('Jordan watch');
    expect(m.html).toContain('Drop news');
    expect(m.html).toContain('q=Jordan%204%20Military%20Blue');
  });

  it('follow-up falls back when nothing was selected', () => {
    const m = followupMail({ ...base, interests: [], shoes: [] });
    expect(m.html).toContain('Browse sneakers');
  });

  it('escapes HTML in user-supplied name and shoe', () => {
    const m = followupMail({ ...base, name: '<script>x</script>', shoes: ['"><img src=x>'] });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x>');
  });
});
