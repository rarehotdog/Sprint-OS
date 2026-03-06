declare module "next-pwa" {
  import type { NextConfig } from "next";

  type NextPwaOptions = {
    dest: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
  };

  function withPWA(options?: NextPwaOptions): (config: NextConfig) => NextConfig;

  export default withPWA;
}
