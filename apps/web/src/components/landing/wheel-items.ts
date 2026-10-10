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

export const WHEEL_ITEMS: WheelItem[] = [
  { brand: 'Nike', name: 'Air Force 1', src: '/wheel/nike-1.webp', bg: 'linear-gradient(160deg,#DCD3C3,#B8AB94)', blend: true },
  { brand: 'Adidas', name: 'Samba OG', src: '/wheel/adidas-1.webp', bg: 'linear-gradient(160deg,#F0CE4E,#C79A12)' },
  { brand: 'Puma', name: 'Speedcat', src: '/wheel/puma-1.webp', bg: 'linear-gradient(160deg,#34343E,#0E0E14)' },
  { brand: 'New Balance', name: '9060', src: '/wheel/new-balance-1.webp', bg: 'linear-gradient(160deg,#CBD0E6,#9AA2C8)', blend: true },
  { brand: 'ASICS', name: 'Mexico 66', src: '/wheel/asics-3.webp', bg: 'linear-gradient(160deg,#2A241C,#0B0907)' },
  { brand: 'Reebok', name: 'Classic Nylon', src: '/wheel/reebok1.webp', bg: 'linear-gradient(160deg,#DADEE6,#8D94A4)' },
  { brand: 'Air Jordan', name: 'Jordan 1 Low', src: '/wheel/nike-2.webp', bg: 'linear-gradient(160deg,#C8323E,#7A0E1A)' },
  { brand: 'On', name: 'Cloudsurfer', src: '/wheel/on-1.webp', bg: 'linear-gradient(160deg,#6F86B0,#2A3552)' },
  { brand: 'Yeezy', name: 'Boost 350 V2', src: '/wheel/adidas-2.webp', bg: 'linear-gradient(160deg,#7F9250,#2D3A0E)' },
  { brand: 'Comet', name: 'Low Top', src: '/wheel/comet.webp', bg: 'linear-gradient(160deg,#F3D9BC,#DDA977)', blend: true },
  { brand: 'ASICS', name: 'Gel Runner', src: '/wheel/asics-1.webp', bg: 'linear-gradient(160deg,#27345A,#0E1530)' },
  { brand: 'Puma', name: 'Palermo', src: '/wheel/puma-2.webp', bg: 'linear-gradient(160deg,#D2DCEB,#9FB0C9)', blend: true },
  { brand: 'Skechers', name: 'Training', src: '/wheel/skechers.webp', bg: 'linear-gradient(160deg,#6FB2A8,#2D6B63)' },
  { brand: 'New Balance', name: '327', src: '/wheel/new-balance-2.webp', bg: 'linear-gradient(160deg,#E8DEC8,#C9B993)', blend: true },
  { brand: 'Under Armour', name: 'Curry', src: '/wheel/under-armor-1.webp', bg: 'linear-gradient(160deg,#34384A,#0D0F18)' },
  { brand: 'ASICS', name: 'Onitsuka Classic', src: '/wheel/asics-2.webp', bg: 'linear-gradient(160deg,#DCE5F2,#A9BBD6)', blend: true },
];
