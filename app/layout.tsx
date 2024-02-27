import './global.css';

import React from 'react';

export const metadata = {
    title: 'ENS Page',
    description: 'Created with <3',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <script
                    defer
                    data-domain="ens.page"
                    src="https://science.nt3.me/js/script.local.manual.js"
                ></script>
                <script
                    dangerouslySetInnerHTML={{
                        __html: 'window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }',
                    }}
                />
            </head>
            <body>{children}</body>
            <script defer src="https://v3x.report/please.js" async={true} />
            {/* <body className="bg-[#2A2244] text-white">{children}</body> */}
        </html>
    );
}
