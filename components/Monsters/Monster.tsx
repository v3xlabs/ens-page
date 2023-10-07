'use client';
/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import clsx from 'clsx';
import { FC, useEffect, useMemo, useState } from 'react';

export const Monster: FC<{ src: string; className: string }> = ({
    src,
    className,
}) => {
    const health = useMemo(() => Math.round(Math.random() * 10), [0]);
    const [blinkAnimationTriggered, setBlinkAnimationTriggered] =
        useState(false);
    const [clickCount, setClickCount] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setBlinkAnimationTriggered(true);
            setTimeout(() => {
                setBlinkAnimationTriggered(false);
            }, 250);
        }, 3000 + Math.random() * 3000);

        return () => clearInterval(interval);
    }, [0]);

    return (
        <img
            src={src}
            alt=""
            className={clsx(
                blinkAnimationTriggered ? 'animate-bob' : '',
                clickCount > health ? 'animate-monster-out' : '',
                className
            )}
            onClick={() => {
                setBlinkAnimationTriggered(true);
                setClickCount(clickCount + 1);
                setTimeout(() => {
                    setBlinkAnimationTriggered(false);
                }, 250);
            }}
        />
    );
};
