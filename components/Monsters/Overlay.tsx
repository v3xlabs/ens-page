import { FC } from 'react';

import { Monster } from './Monster';

export const MonsterOverlay: FC = () => {
    return (
        <div className="aspect-[300/200] max-h-full max-w-full mx-auto object-contain relative">
            {/* <img
                src="/frensday_1.svg"
                alt="frensday"
                className="w-full h-full object-contain"
            /> */}
            <Monster
                src="/monster_1.svg"
                className="absolute top-0 right-3.5 z-10"
            />
            <Monster
                src="/monster_2.svg"
                className="absolute bottom-4 right-1.5"
            />
            <Monster
                src="/monster_3.svg"
                className="absolute bottom-2 left-0.5"
            />
            <Monster
                src="/monster_4.svg"
                className="absolute bottom-2 left-9"
            />
            <Monster
                src="/monster_5.svg"
                className="absolute top-3 left-[69px]"
            />
            <Monster src="/monster_6.svg" className="absolute top-1.5 left-2" />
        </div>
    );
};
