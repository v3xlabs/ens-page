'use client';

import { FC, useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';

import { IYKRefResponse as IYKReferenceResponse } from '../../hooks/useIYKRef';
import { POAPMetadata } from '../../hooks/usePOAPData';

// 10 days
const HIDE_AFTER_TIME = 1000 * 60 * 60 * 24 * 100;

export const POAPModal: FC<{
    data: IYKReferenceResponse;
    name: string;
    metadata: POAPMetadata;
}> = ({ data, name, metadata }) => {
    const [dismissed, setDismissed] = useState(false);
    const [hasRendered, setHasRendered] = useState(false);

    const [event] = data.poapEvents;
    const expiry_data = metadata.attributes.find(
        (attribute) => attribute.trait_type == 'endDate'
    );

    const expiry_date = new Date(expiry_data.value).getTime();
    const current_date = Date.now();

    const shouldHideCuzExpired =
        event.status === 'expired' &&
        expiry_date - current_date + HIDE_AFTER_TIME < 0;

    useEffect(() => {
        setHasRendered(true);
    }, [0]);

    if (dismissed || !hasRendered || shouldHideCuzExpired) return;

    return (
        <div className="fixed bottom-0 inset-x-0 px-2 pb-4">
            <div className="w-full max-w-md3 mx-auto">
                <div className="p-4 text-center relative">
                    <img
                        src="/creeper.svg"
                        alt=""
                        className="absolute top-0 left-4 h-12"
                    />
                    <div className="absolute inset-x-0 bottom-0 top-12 bg-[#14032C] rounded-3xl -z-10"></div>
                    <div className="w-24 h-24 bg-slate-100 rounded-full mx-auto">
                        <img
                            src={metadata.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="">
                        <div className="px-4 py-2 btn w-fit mx-auto -translate-y-3 font-bold">
                            Mint POAP
                        </div>
                    </div>
                    <button
                        className="absolute right-4 top-16 text-xl opacity-50"
                        onClick={() => {
                            setDismissed(true);
                        }}
                    >
                        <FiX />
                    </button>
                    <div className="w-full max-w-xs mx-auto">
                        Claim your POAP to show you met {name} at frENSday!
                    </div>
                </div>
            </div>
        </div>
    );
};
