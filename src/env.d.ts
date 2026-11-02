/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly CALDIY_BOOKING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
