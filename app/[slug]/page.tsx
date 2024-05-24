/* eslint-disable unicorn/prevent-abbreviations */
import { ens_normalize } from '@adraffy/ens-normalize';
import clsx from 'clsx';
import { Metadata } from 'next';
import Link from 'next/link';

import { MonsterOverlay } from '../../components/events/frensday/Monsters/Overlay';
import { EventHeader } from '../../components/Headers/EventHeader';
import { SPOAPModal } from '../../components/POAPModal/SPOAPModal';
import { ProfileAvatar } from '../../components/ProfileAvatar/ProfileAvatar';
import { RecordsSection } from '../../components/Records/records';
import { XMTPSection } from '../../components/XMTP/section';
import { useEnstate } from '../../hooks/useEnstate';
import { useIYKRef } from '../../hooks/useIYKRef';
import { useWarpcast } from '../../hooks/useWarpcast';

const theme2Class = {
    frensday2023: 'theme-frensday2023',
    ethdenver2024: 'theme-ethdenver24',
};

const theme2Color = {
    frensday2023: '#2A2244',
    ethdenver2024: '#888CDC',
};

export default async function ({
    params: { slug },
    searchParams: { event, iykRef },
}: {
    params: { slug: string };
    searchParams: { event?: string; iykRef?: string };
}) {
    const raw_name = slug;
    const name = ens_normalize(raw_name.toLowerCase());
    const ad_class: string = theme2Class[event] || 'theme-generic';

    if (raw_name.toLowerCase() !== name) {
        throw new Error('Invalid ENS name');
    }

    const [enstate, farcaster, iykData] = await Promise.all([
        useEnstate(name),
        useWarpcast(name),
        useIYKRef(iykRef),
    ]);

    return (
        <div className={clsx('w-full mt-4 lg:mt-10 px-6 py-8 pb-64', ad_class)}>
            <div className="w-full max-w-md2 mx-auto flex flex-col gap-8">
                <EventHeader event={event} />
                <div className="w-full flex flex-col gap-2 items-center justify-center">
                    <div className="flex items-center relative w-full pt-8 pb-2">
                        <div className="mx-auto w-40 h-40 aspect-square border bg-white rounded-full overflow-hidden">
                            <ProfileAvatar name={enstate.name} />
                        </div>
                        {event == 'frensday2023' && (
                            <div className="absolute inset-0">
                                <MonsterOverlay />
                            </div>
                        )}
                    </div>
                    <div className="text-center px-2 space-y-2">
                        <div className="text-3xl font-extrabold text-center">
                            {enstate.name}
                        </div>
                        {enstate.records?.description && (
                            <div>{enstate.records.description}</div>
                        )}
                    </div>
                </div>
                <RecordsSection enstate={enstate} farcaster={farcaster} />
                {['frensday2023', 'ethdenver2024'].includes(event) && (
                    <XMTPSection
                        address={enstate.address}
                        name={enstate.name}
                        event={event}
                    />
                )}
                {iykData && (
                    <SPOAPModal
                        data={iykData}
                        name={enstate.name}
                        event={event}
                    />
                )}
                <div className="text-center">
                    Site by{' '}
                    <Link
                        href="https://ens.domains/?utm_source=ens-page&utm_campaign=footer"
                        className="link"
                        target="_blank"
                    >
                        ENS
                    </Link>{' '}
                    &{' '}
                    <Link
                        href="https://v3x.company/?utm_source=ens-page&utm_campaign=footer"
                        className="link"
                        target="_blank"
                    >
                        V3X
                    </Link>
                </div>
            </div>
        </div>
    );
}

// Metadata

export async function generateMetadata({
    params: { slug },
    searchParams: { event, iykRef },
}: {
    params: { slug: string };
    searchParams: { event?: string; iykRef?: string };
}) {
    const raw_name = slug;
    const name = ens_normalize(raw_name.toLowerCase());
    const theme_color = theme2Color[event] || '#F6F6F6';

    if (raw_name.toLowerCase() !== name) {
        throw new Error('Invalid ENS name');
    }

    const data = await useEnstate(name);

    return {
        title: `${data.name} | ENS Page`,
        description:
            data.records?.description || `View ${data.name}'s ENS Page`,
        icons: data.avatar,
        themeColor: theme_color,
    } as Metadata;
}
