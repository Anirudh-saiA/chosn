/**
 * The landing page's six featured sneakers. Each one owns a flat, bold colour
 * block taken from the shoe itself: `bg` is the panel behind it, `fg` the text on
 * that panel, `disc` the lighter spotlight circle that separates the shoe from
 * the panel, and `accent` the same hue as a title colour on the cream page.
 */
export interface LandingShoe {
  id: string;
  brand: string;
  model: string;
  colourway: string;
  /** hero-slider label */
  label: string;
  src: string;
  alt: string;
  /** word matched against the live catalog to find this shoe's best price */
  keyword: string;
  bg: string;
  fg: string;
  disc: string;
  accent: string;
  /** vivid light colour for the ambient glow */
  glow: string;
}

export const SHOES: LandingShoe[] = [
  {
    id: 'dunk',
    brand: 'Nike',
    model: 'Dunk Low',
    colourway: 'Sail / Team Red',
    label: 'Nike Dunk Low · Sail / Red',
    src: '/images/hero-dunk-low.png',
    alt: 'Nike Dunk Low in sail and team red',
    keyword: 'dunk',
    bg: '#B3121F',
    fg: '#FFFFFF',
    disc: 'rgba(255,255,255,0.26)',
    accent: '#B3121F',
    glow: '#FF2A3C',
  },
  {
    id: 'jordan',
    brand: 'Air Jordan',
    model: 'Jordan 1 High OG',
    colourway: 'Sail / Mocha',
    label: 'Air Jordan 1 High OG · Mocha',
    src: '/images/hero-jordan-1.png',
    alt: 'Air Jordan 1 High OG in sail, mocha and brown',
    keyword: 'jordan',
    bg: '#5B2A0E',
    fg: '#FFFFFF',
    disc: 'rgba(255,214,170,0.30)',
    accent: '#5B2A0E',
    glow: '#E08A2E',
  },
  {
    id: 'yeezy',
    brand: 'adidas',
    model: 'Yeezy Boost 350 V2',
    colourway: 'Core Black / Green',
    label: 'adidas Yeezy Boost 350 V2 · Core Black',
    src: '/images/hero-yeezy-350.png',
    alt: 'adidas Yeezy Boost 350 V2 in core black and green',
    keyword: 'yeezy',
    bg: '#34430F',
    fg: '#FFFFFF',
    disc: 'rgba(220,240,160,0.32)',
    accent: '#34430F',
    glow: '#9BD12A',
  },
  {
    id: 'samba',
    brand: 'adidas',
    model: 'Samba OG',
    colourway: 'White / Black / Gum',
    label: 'adidas Samba OG · White / Black / Gum',
    src: '/images/hero-samba.png',
    alt: 'adidas Samba OG in white, black and gum',
    keyword: 'samba',
    bg: '#0A3FB0',
    fg: '#FFFFFF',
    disc: 'rgba(255,255,255,0.24)',
    accent: '#0A3FB0',
    glow: '#2E6BFF',
  },
  {
    id: 'syracuse',
    brand: 'Nike',
    model: 'Dunk Low Syracuse',
    colourway: 'Orange / White',
    label: 'Nike Dunk Low · Syracuse Orange',
    src: '/images/hero-dunk-syracuse.png',
    alt: 'Nike Dunk Low Syracuse in orange and white',
    keyword: 'syracuse',
    bg: '#C2410C',
    fg: '#FFFFFF',
    disc: 'rgba(255,255,255,0.30)',
    accent: '#C2410C',
    glow: '#FF7A1F',
  },
  {
    id: 'onitsuka',
    brand: 'Onitsuka Tiger',
    model: 'Mexico 66',
    colourway: 'Yellow / Black',
    label: 'Onitsuka Tiger · Mexico 66 Yellow',
    src: '/images/hero-onitsuka.png',
    alt: 'Onitsuka Tiger Mexico 66 in yellow and black',
    keyword: 'onitsuka',
    bg: '#15110D',
    fg: '#F7BE0C',
    disc: 'rgba(247,190,12,0.22)',
    accent: '#B86A00',
    glow: '#FFC400',
  },
];

export const shoeById = (id: string): LandingShoe => SHOES.find((s) => s.id === id) ?? SHOES[0]!;

/** Best live price + buy/wait signal for a featured shoe, when the catalog has a match. */
export interface ShoePrice {
  price: string;
  signal: 'buy' | 'wait' | null;
}
