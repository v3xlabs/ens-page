import { ens_normalize } from '@adraffy/ens-normalize';
import { formatRecord } from '@ens-tools/format';
import { FC, PropsWithChildren, ReactNode } from 'react';
import { FaTelegram } from 'react-icons/fa';
import { FiGithub, FiLink, FiTwitter } from 'react-icons/fi';
import shortNumber from 'short-number';

import { useEnstate } from '../../hooks/useEnstate';
import { useWarpcast } from '../../hooks/useWarpcast';

const Button: FC<PropsWithChildren<{ href: string }>> = ({
    children,
    href,
}) => {
    return (
        <a
            href={href}
            target="_blank"
            className="bg-[#7116EB] relative rounded-lg px-4 py-3 flex items-center justify-center gap-2"
        >
            {children}
        </a>
    );
};

const buttonControls = (key: string, value: string): ReactNode | undefined => {
    const formatted = formatRecord(key as any, value);

    if (key == 'com.twitter') {
        return (
            <Button href={'https://twitter.com/' + formatted}>
                <FiTwitter />
                {formatted || value}
            </Button>
        );
    }

    if (key == 'url') {
        const { hostname } = new URL(formatted || value);

        return (
            <Button href={value}>
                <FiLink />
                {hostname}
            </Button>
        );
    }

    if (key == 'com.github') {
        return (
            <Button href={'https://github.com/' + (formatted || value)}>
                <FiGithub />
                {formatted || value}
            </Button>
        );
    }

    if (key == 'org.telegram') {
        return (
            <Button
                href={'https://t.me/' + (formatted || value).replace(/^@/, '')}
            >
                <FaTelegram />
                {formatted || value}
            </Button>
        );
    }

    if (key == 'com.discord') {
        // TODO: Discord url: https://discord.com/users/1234567890 <-- userid
        // Can be done once discord implements a way to resolve user ids, or we change the record
    }

    // return <div>Unknown {key}</div>;
};

export default async function ({
    params: { slug },
}: {
    params: { slug: string };
}) {
    const raw_name = slug;
    const name = ens_normalize(raw_name.toLowerCase());

    if (raw_name.toLowerCase() !== name) {
        throw new Error('Invalid ENS name');
    }

    const [enstate, farcaster] = await Promise.all([
        useEnstate(name),
        useWarpcast(name),
    ]);

    return (
        <div className="mx-auto w-full max-w-md flex flex-col gap-8 mt-4 lg:mt-10 px-6 py-8">
            <div className="text-center px-4">
                <img
                    src="/frensday_2.png"
                    alt="frensday"
                    className="w-full h-auto mx-auto"
                />
                <div>November 13 2023, Istanbul Türkiye</div>
            </div>
            <div className="w-full flex flex-col gap-2 items-center justify-center">
                <div className="flex items-center relative w-full pt-8">
                    <div className="mx-auto w-40 h-40 aspect-square border bg-white rounded-full overflow-hidden">
                        <img
                            src={enstate.avatar}
                            alt="profile"
                            className="w-full h-full"
                        />
                    </div>
                    <div className="absolute inset-0">
                        <img
                            src="/frensday_1.svg"
                            alt="frensday"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>
                <div className="text-center px-2 py-2 space-y-2">
                    <div className="text-3xl font-extrabold text-center">
                        {enstate.name}
                    </div>
                    {enstate.records.description && (
                        <div>{enstate.records.description}</div>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-4">
                {Object.keys(enstate.records)
                    .map((key) => buttonControls(key, enstate.records[key]))
                    .filter(Boolean)}
                {farcaster && farcaster.result && (
                    <Button
                        href={`https://warpcast.com/${farcaster.result.user.username}`}
                    >
                        <img
                            src="/warpcaster.svg"
                            alt="warpcaster"
                            style={{ height: '1em', width: '1em' }}
                        ></img>
                        {farcaster.result.user.username}
                        <div className="bg-white/20 text-white px-2 py-1 rounded-md absolute right-2">
                            {shortNumber(farcaster.result.user.followerCount)}
                        </div>
                    </Button>
                )}
                <Button href={'https://ens.app/' + name}>
                    <div
                        className="bg-white"
                        style={{ height: '1em', width: '1em' }}
                    ></div>
                    View on ENS App
                </Button>
            </div>
        </div>
    );
}

// Metadata
import { Metadata } from 'next';

// or Dynamic metadata
export async function generateMetadata({
    params: { slug },
}: {
    params: { slug: string };
}) {
    const raw_name = slug;
    const name = ens_normalize(raw_name.toLowerCase());

    if (raw_name.toLowerCase() !== name) {
        throw new Error('Invalid ENS name');
    }

    const data = await useEnstate(name);

    return {
        title: `${data.name} | ENS Page`,
        description: data.records.description || `View ${data.name}'s ENS Page`,
        icons: data.avatar,
    } as Metadata;
}
