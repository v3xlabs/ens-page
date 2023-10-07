/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import cslx from 'clsx';
import { useEffect, useState } from 'react';

export const Creeper = () => {
    const [blinkAnimationTriggered, setBlinkAnimationTriggered] =
        useState(false);
    const [clickCount, setClickCount] = useState(0);

    // every 5 seconds, blink
    useEffect(() => {
        const interval = setInterval(() => {
            setBlinkAnimationTriggered(true);
            setTimeout(() => {
                setBlinkAnimationTriggered(false);
            }, 250);
        }, 10_000);

        return () => clearInterval(interval);
    }, [0]);

    return (
        <div
            className={cslx(
                'absolute -top-12 left-4 h-12 sm:w-32 -z-10',
                clickCount > 5 ? 'animate-creeper-out' : 'hidden xs:block'
            )}
        >
            <div
                className="relative w-fit h-full mx-auto"
                onClick={() => {
                    setBlinkAnimationTriggered(true);
                    setClickCount(clickCount + 1);
                    setTimeout(() => {
                        setBlinkAnimationTriggered(false);
                    }, 250);
                }}
            >
                <img
                    src="/creeper_eye.svg"
                    className="w-1 h-1 absolute transition-transform z-10"
                    alt="eye"
                    style={{
                        transform: blinkAnimationTriggered
                            ? 'scaleY(0.5) scaleX(1.2)'
                            : '',
                        left: '60%',
                        top: blinkAnimationTriggered ? '34px' : '35px',
                    }}
                />
                <img
                    src="/creeper_eye.svg"
                    className="w-1 h-1 absolute transition-transform z-10"
                    alt="eye"
                    style={{
                        transform: blinkAnimationTriggered
                            ? 'scaleY(0.5) scaleX(1.2)'
                            : '',
                        left: '70%',
                        top: blinkAnimationTriggered ? '34px' : '35px',
                    }}
                />
                <img
                    src="/creeper.svg"
                    alt=""
                    className="cursor-pointer transition-transform"
                    style={{
                        transform: blinkAnimationTriggered
                            ? 'scaleY(1.05) translateY(-2.5%)'
                            : '',
                    }}
                />
            </div>
        </div>
    );
};
