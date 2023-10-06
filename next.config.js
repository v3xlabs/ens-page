/** @type {import('next').NextConfig} */
// eslint-disable-next-line unicorn/no-empty-file
module.exports = {
    reactStrictMode: true,
    output: 'standalone',
    webpack: (config) => {
        config.resolve.fallback = { fs: false, net: false, tls: false };

        return config;
    },
};
