import { FC } from 'react';

export const ExpiredPOAP: FC<{}> = () => {
    return (
        <div>
            This POAP is expired and can no longer be redeemed. You can
            reprogram your card{' '}
            <a
                href="https://iyk.app/admin?utm_source=ens-page&utm_campaign=expired-poap"
                target="_blank"
                className="text-ens-light-blue-primary underline"
            >
                via the IYK Dashboard
            </a>
            .
        </div>
    );
};
