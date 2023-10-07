import { FC } from 'react';

import { AButton } from '../AButton/button';

export const XMTPSection: FC<{ name: string; address: string }> = ({
    name,
    address,
}) => {
    return (
        <div className="text-center space-y-4 mt-4">
            <div className="text-2xl font-bold px-8">
                Send {name} a <span className="text-[#3889FF]">frENSday</span>{' '}
                message
            </div>
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
