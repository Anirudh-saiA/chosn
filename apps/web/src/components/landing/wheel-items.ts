/**
 * The cards on the Discover shoe wheel. `src` is a shoe photo in /public/wheel and
 * `bg` that card's own background. `blend` is for photos that still have a white
 * background (white shoes that can't be cut out cleanly): they are multiplied onto
 * the card colour so the white drops away.
 */
export interface WheelItem {
  brand: string;
  name: string;
  src: string;
  bg: string;
  blend?: boolean;
}

/** Photos with a white background sit on a clean white studio card with dark text, so the shoe keeps its true colours. */

export const WHEEL_ITEMS: WheelItem[] = [
  { brand: 'Adidas', name: 'Samba OG', src: '/wheel/adidas-1.webp', bg: '#F0CE4E' },
  { brand: 'Puma', name: 'Speedcat', src: '/wheel/puma-1.webp', bg: '#34343E' },
  { brand: 'New Balance', name: '9060', src: '/wheel/new-balance-1.webp', bg: '#F5F5F5', blend: true },
  { brand: 'ASICS', name: 'Mexico 66', src: '/wheel/asics-3.webp', bg: '#2A241C' },
  { brand: 'Reebok', name: 'Classic Nylon', src: '/wheel/reebok1.webp', bg: '#F0463C' },
  { brand: 'Air Jordan', name: 'Jordan 1 Low', src: '/wheel/nike-2.webp', bg: '#C8323E' },
  { brand: 'On', name: 'Cloudsurfer', src: '/wheel/on-1.webp', bg: '#3F73F5' },
  { brand: 'Yeezy', name: 'Boost 350 V2', src: '/wheel/adidas-2.webp', bg: '#8DB542' },
  { brand: 'Comet', name: 'Low Top', src: '/wheel/comet.webp', bg: '#F5F5F5', blend: true },
  { brand: 'ASICS', name: 'Gel Runner', src: '/wheel/asics-1.webp', bg: '#27345A' },
  { brand: 'Puma', name: 'Palermo', src: '/wheel/puma-2.webp', bg: '#F5F5F5', blend: true },
  { brand: 'Skechers', name: 'Training', src: '/wheel/skechers.webp', bg: '#6FB2A8' },
  { brand: 'New Balance', name: '327', src: '/wheel/new-balance-2.webp', bg: '#F5F5F5', blend: true },
  { brand: 'Under Armour', name: 'Curry', src: '/wheel/under-armor-1.webp', bg: '#34384A' },
  { brand: 'ASICS', name: 'Onitsuka Classic', src: '/wheel/asics-2.webp', bg: '#F5F5F5', blend: true },
];
