/// <reference types="vite/client" />

type ViteBoolString = "true" | "false";

declare interface ImportMetaEnv {
  readonly VITE_USE_MOCK_API?: ViteBoolString;
  readonly VITE_ENABLE_DEV_PAGE?: ViteBoolString;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
