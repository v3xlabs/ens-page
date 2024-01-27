import { formatAddress } from '@ens-tools/format';
import clsx from 'clsx';
import { FC, useState } from 'react';
import { FiCheck, FiLoader } from 'react-icons/fi';

const eth_address_regex = /^0x[\dA-Fa-f]{40}$/;

export const MintToProfile: FC<{
    address: string;
    poap_name: string;
    event_name: string;
    onCallChange: () => void;
    onCallClose: () => void;
}> = ({ address, poap_name, event_name, onCallChange, onCallClose }) => {
    const isAddress = eth_address_regex.test(address);
    const [stage, setStage] = useState<'start' | 'minting' | 'minted'>('start');

    return (
        <div className="space-y-2 w-full">
            <div className="w-full max-w-xs mx-auto">
                Mint a POAP to show you met {poap_name} at {event_name}!
            </div>
            <div className="w-full">
                <button
                    className={clsx(
                        'btn w-full py-3 space-x-2 transition-all',
                        stage === 'minted' && '!bg-ens-light-green-primary'
                    )}
                    onClick={() => {
                        if (stage === 'minted') {
                            onCallClose();

                            return;
                        }

                        setStage('minting');

                        setTimeout(() => {
                            setStage('minted');
                        }, 1000);
                    }}
                    disabled={stage === 'minting'}
                >
                    {stage === 'start' && 'Mint POAP'}
                    {stage === 'minting' && 'Minting...'}
                    {stage === 'minted' && 'Minted'}
                    {stage === 'minting' && (
                        <FiLoader className="animate-spin" />
                    )}
                    {stage === 'minted' && <FiCheck />}
                </button>
            </div>
            <div className="w-full flex justify-between px-2">
                <div className="flex items-center gap-1">
                    <div>to</div>
                    <div className="flex items-center gap-1">
                        {!isAddress && (
                            <span className="w-4 h-4 rounded-full bg-ens-light-blue-surface border border-ens-light-border">
                                <img
                                    src={'https://enstate.rs/i/' + address}
                                    alt=""
                                    className="rounded-full w-full h-full border-none"
                                />
                            </span>
                        )}
                        <span className="font-bold">
                            {isAddress ? formatAddress(address) : address}
                        </span>
                    </div>
                </div>
                {stage === 'start' && (
                    <button
                        className="text-ens-light-blue-primary px-1"
                        onClick={onCallChange}
                    >
                        Change
                    </button>
                )}
            </div>
        </div>
    );
};
