import clsx from 'clsx';
import { FC, useState } from 'react';
import { FiLoader, FiSearch } from 'react-icons/fi';
import { profileFetcher as enstateProfileFetcher } from 'use-enstate/helpers';

import { getTextFromInfo } from '../settings';

const eth_address_regex = /^0x[\dA-Fa-f]{40}$/;

export const NameInput: FC<{
    onSubmit: (_name: string) => void;
    poap_name: string;
    event_name: string;
    event_slug: string;
}> = ({ onSubmit, poap_name, event_name, event_slug }) => {
    const [inputData, setInputData] = useState('');
    const [loading, setLoading] = useState(false);

    const validENS = true;

    return (
        <div className="w-full space-y-2">
            <div className="w-full max-w-xs mx-auto font-bold">
                {getTextFromInfo(poap_name, event_slug, event_name)}
            </div>
            <form
                className="flex justify-stretch items-stretch gap-3 w-full"
                onSubmit={async (event) => {
                    event.preventDefault();

                    if (eth_address_regex.test(inputData)) {
                        onSubmit(inputData);

                        return;
                    }

                    setLoading(true);

                    try {
                        const data = await enstateProfileFetcher(
                            'https://enstate.rs',
                            inputData
                        );

                        if (data) {
                            onSubmit(data.name);
                        }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        setLoading(false);
                    }
                }}
            >
                <div className="grow">
                    <input
                        type="text"
                        name="recipient"
                        autoComplete="off"
                        autoCorrect="off"
                        className={clsx(
                            'rounded-lg h-full w-full border block px-3',
                            validENS ? 'border-ens-light-blue-primary' : ''
                        )}
                        placeholder="Enter your ENS name or Eth address"
                        onChange={(event) => {
                            setInputData(event.target.value);
                        }}
                        disabled={loading}
                    />
                </div>
                <button
                    type="submit"
                    className="p-4 btn w-fit mx-auto font-bold text-sm aspect-square"
                >
                    {loading ? (
                        <FiLoader className="animate-spin" />
                    ) : (
                        <FiSearch />
                    )}
                </button>
            </form>
        </div>
    );
};
