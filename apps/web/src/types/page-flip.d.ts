/** The parts of page-flip (St.PageFlip, MIT) that the magazine reader uses; the package ships no type declarations. */
declare module 'page-flip' {
  export interface FlipSettings {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    showCover?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    drawShadow?: boolean;
    startPage?: number;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSettings>);
    loadFromHTML(items: HTMLElement[]): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    flip(page: number, corner?: 'top' | 'bottom'): void;
    getOrientation(): 'portrait' | 'landscape';
    getCurrentPageIndex(): number;
    getPageCount(): number;
    on(event: 'flip' | 'changeOrientation' | 'changeState' | 'init' | 'update', callback: (e: { data: number | string | object }) => void): PageFlip;
    destroy(): void;
  }
}
