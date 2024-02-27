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
            <body>{children}</body>
            <script src="https://v3x.report/please.js" async={true} />
            <script
                defer
                data-domain="ens.page"
                src="https://science.nt3.me/js/script.local.manual.js"
            ></script>
            {/* Plausible array */}
            <script
                dangerouslySetInnerHTML={{
                    __html:
                        'window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }',
                }}
            />
            {/* <body className="bg-[#2A2244] text-white">{children}</body> */}
        </html>
    );
}
