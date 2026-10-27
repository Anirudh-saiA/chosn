// What a customer pays and the struck-through price on a VegNonVeg product page.
// The price block is <p><span><del>old</del></span><span>now</span></p> on a marked-down shoe and <p><span>now</span></p> otherwise,
// so the FIRST span is the old price on a sale (that was the bug: the scraper stored the old price as the price).
const digits = (t) => (t || '').replace(/[^\d]/g, '');

export function extractPrice($) {
  const block = $('h1.p-name').parent().find('p').filter((_, e) => /₹|&#8377;/.test($(e).html() || '') && $(e).find('span').length > 0).first();
  const was = digits(block.find('del').first().text());
  const spans = block.find('span').filter((_, e) => $(e).find('del').length === 0);
  const now = digits(spans.last().text());
  // The page also carries the price the store reports to Google ("price":"7051.00"); used when the block is missing.
  const m = ($.html() || '').match(/var product = \{[^}]*?"price":"(\d+)(?:\.\d+)?"/);
  const json = m ? m[1] : '';
  const price = now || json;
  return { price, compareAt: was && price && Number(was) > Number(price) ? was : '', json };
}
