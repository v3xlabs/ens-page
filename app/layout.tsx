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
            {/* <body className="bg-[#2A2244] text-white">{children}</body> */}
        </html>
    );
}
