declare global {
  interface Window {
    h3code?: {
      selectRepository: () => Promise<{ path: string } | null>;
    };
  }
}

export {};
