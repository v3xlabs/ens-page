'use client';

import { FC } from 'react';

import { IYKRefResponse as IYKReferenceResponse } from '../hooks/useIYKRef';
import { POAPMetadata } from '../hooks/usePOAPData';

export const POAPModal: FC<{
    data: IYKReferenceResponse;
    name: string;
    metadata: POAPMetadata;
}> = ({ data, name, metadata }) => {
    return (
        <div className="fixed bottom-0 inset-x-0 px-3 pb-4">
            <div className="w-full max-w-md mx-auto">
                <div className="p-4 text-center relative">
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
                    Claim your POAP to show you met {name} at frENSday!
                </div>
            </div>
        </div>
    );
};
