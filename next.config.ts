import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  experimental: { serverComponentsExternalPackages: ['docxtemplater', 'pizzip'] },
}
export default nextConfig
