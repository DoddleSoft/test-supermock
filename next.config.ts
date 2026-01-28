import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uneohrudlfjvcxdvltrj.supabase.co", // Your specific project ID
        port: "",
        pathname: "/storage/v1/object/public/**", // Allow all public storage files
      },
    ],
  },
};

export default nextConfig;
