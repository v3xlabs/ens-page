/** @type {import('tailwindcss').Config} */
// eslint-disable-next-line unicorn/no-empty-file
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',

        // Or if using `src` directory:
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            screens: {
                xs: '380px',
            },
            maxWidth: {
                md2: '420px',
                md3: '458px',
            },
        },
    },
    plugins: [],
};
