// node vegnonveg-price.test.mjs   (needs scripts/crawl/node_modules, i.e. npm install)
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { extractPrice } from './vegnonveg-price.mjs';

const page = (priceHtml, json = '7051.00') => load(`<div><h1 class="p-name">Nike DUNK LOW RETRO</h1><p>WHITE/BLACK</p><p class="font-20">${priceHtml}</p></div>
  <script>var product = {"id":1,"name":"DUNK","price":"${json}","brand":"Nike"};</script>`);

// marked down: the struck-through price comes first in the page, the price to pay second
assert.deepEqual(extractPrice(page('<span><del> &#8377; 8,295 </del></span><span> &#8377; 7,051 </span>')), { price: '7051', compareAt: '8295', json: '7051' });
// not marked down
assert.deepEqual(extractPrice(page('<span> &#8377; 8,295 </span>', '8295.00')), { price: '8295', compareAt: '', json: '8295' });
// a struck-through price that is not higher than the price is ignored
assert.equal(extractPrice(page('<span><del>&#8377; 5,000</del></span><span>&#8377; 7,051</span>')).compareAt, '');
console.log('vegnonveg-price: 3 checks passed');
