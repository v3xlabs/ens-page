import { FC } from 'react';
import { FiExternalLink } from 'react-icons/fi';

export const AlreadyClaimed: FC<{ to: string }> = ({ to }) => {
    return (
        <div className="space-y-2 w-full">
            <p>It appears you already have this POAP 🎉</p>
            <p>You should see it in your collection</p>
            <a
                // href={'https://collectors.poap.xyz/token/' + poap_id}
                href={
                    'https://collectors.poap.xyz/scan/' +
                    to +
                    '?utm_source=ens-page'
                }
                target="_blank"
                className="btn w-full p-4"
            >
                View Collection <FiExternalLink />
            </a>
        </div>
    );
};
