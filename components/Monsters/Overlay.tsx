import { FC } from 'react';

export const MonsterOverlay: FC = () => {
    return (
        <div className="aspect-[300/200] max-h-full max-w-full mx-auto object-contain relative">
            {/* <img
                src="/frensday_1.svg"
                alt="frensday"
                className="w-full h-full object-contain"
            /> */}
            <img
                src="/monster_1.svg"
                alt=""
                className="absolute top-0 right-3.5"
            />
            <img
                src="/monster_2.svg"
                alt=""
                className="absolute bottom-4 right-1.5"
            />
            <img
                src="/monster_3.svg"
                alt=""
                className="absolute bottom-2 left-0.5"
            />
            <img
                src="/monster_4.svg"
                alt=""
                className="absolute bottom-2 left-9"
            />
            <img
                src="/monster_5.svg"
                alt=""
                className="absolute top-3 left-[69px] -z-10"
            />
            <img
                src="/monster_6.svg"
                alt=""
                className="absolute top-1.5 left-2"
            />
        </div>
    );
};
