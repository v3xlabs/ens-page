'use client';

import clsx from 'clsx';
import { FC, useMemo, useState } from 'react';

import { generateMeshGradientFromName } from './MeshGradient';

export const ProfileAvatar: FC<{ name: string }> = ({ name }) => {
    const [failedToLoad, setFailedToLoad] = useState(false);
    const mesh = useMemo(() => generateMeshGradientFromName(name), [name]);

    return (
        <div className="relative aspect-square size-full">
            <div className="bg-ens-light-background-secondary absolute inset-0 size-full"></div>
            <div className="absolute inset-0 size-full" style={mesh}></div>
            <img
                src={'https://avatarservice.xyz/256/' + name + '.webp'}
                className={clsx(
                    'avatar-image absolute inset-0 size-full h-full w-full object-cover',
                    failedToLoad && 'hidden'
                )}
                alt=""
                onError={() => setFailedToLoad(true)}
            />
        </div>
    );
};
