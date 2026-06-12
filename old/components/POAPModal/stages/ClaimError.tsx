// eslint-disable-next-line unicorn/prefer-node-protocol, simple-import-sort/imports
import { inspect } from 'util';
import { FC } from 'react';
import { AlreadyClaimed } from './AlreadyClaimed';

export const ClaimError: FC<{ data: unknown; recipient: string }> = ({
    data,
    recipient,
}) => {
    if (
        data['statusCode'] == 400 &&
        data['error'] == 'Bad Request' &&
        data['message'] == 'You already minted a POAP for this drop.'
    ) {
        return <AlreadyClaimed to={recipient} />;
    }

    return (
        <div className="space-y-2 w-full">
            <p>There was an error claiming this POAP.</p>
            <pre className="text-xs whitespace-break-spaces text-start bg-neutral-200/20 p-2 rounded-lg border">
                <code>{inspect(data)}</code>
            </pre>
        </div>
    );
};
