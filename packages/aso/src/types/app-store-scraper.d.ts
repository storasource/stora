declare module 'app-store-scraper' {
  export function search(options: { term: string; num?: number; country?: string; lang?: string }): Promise<any[]>;
  export function app(options: { id: string | number; country?: string; lang?: string }): Promise<any>;
  export function similar(options: { id: string | number; country?: string; lang?: string }): Promise<any[]>;
  export function list(options: { collection: string; category?: number; country?: string; num?: number; lang?: string }): Promise<any[]>;
  export function developer(options: { devId: string | number; country?: string; lang?: string }): Promise<any[]>;

  export const collection: {
    TOP_FREE_IPHONE: string;
    TOP_PAID_IPHONE: string;
    TOP_GROSSING_IPHONE: string;
    [key: string]: string;
  };

  export const category: {
    [key: string]: number;
  };
}

