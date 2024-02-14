import { FC } from 'react';

import { AButton } from '../AButton/button';

export const XMTPSection: FC<{
    name: string;
    address: string;
    event: string;
}> = ({ name, address, event }) => {
    return (
        <div className="text-center space-y-4 mt-4">
            {event == 'frensday2023' ? (
                <div className="text-3xl font-bold balance px-12">
                    Send {name}
                    <wbr /> a <wbr />
                    <span className="text-[#3889FF]">frENSday</span> message
                </div>
            ) : (
                <div className="text-3xl font-bold balance px-12">
                    Message
                    <br />
                    {name}
                </div>
            )}
            <div className="flex flex-col gap-2">
                <AButton
                    href={`https://go.cb-w.com/messaging?address=${address}`}
                >
                    Message with Coinbase Wallet
                </AButton>
                <AButton href={`https://converse.xyz/dm/${name}`}>
                    Message with Converse
                </AButton>
                <AButton href={'https://orb.ac/@cryptocornerstore'}>
                    Message with Orb
                </AButton>
            </div>
        </div>
    );
};
