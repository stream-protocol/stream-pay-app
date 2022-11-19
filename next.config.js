/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ["metadata.streamprotocol.org"]
    }
}

module.exports = nextConfig