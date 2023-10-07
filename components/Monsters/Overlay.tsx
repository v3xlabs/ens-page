import { FC } from 'react';

export const MonsterOverlay: FC = () => {
    return (
        <div className="aspect-[300/200] max-h-full max-w-full mx-auto object-contain">
            <img
                src="/frensday_1.svg"
                alt="frensday"
                className="w-full h-full object-contain"
            />
        </div>
    );
};
