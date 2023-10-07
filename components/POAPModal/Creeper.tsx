/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
'use client';

import { useState } from 'react';

export const Creeper = () => {
    const [blinkAnimationTriggered, setBlinkAnimationTriggered] =
        useState(false);

    return (
        <div className="absolute top-0 left-4 h-12 sm:w-32 hidden xs:block -translate-y-[1px]">
            <div
                className="relative w-fit h-full mx-auto"
                onClick={() => {
                    setBlinkAnimationTriggered(true);
                    setTimeout(() => {
                        setBlinkAnimationTriggered(false);
                    }, 250);
                }}
            >
                <img
                    src="/creeper_eye.svg"
                    className="w-1 h-1 absolute transition-transform"
                    alt="eye"
                    style={{
                        transform: blinkAnimationTriggered
                            ? 'scaleY(0.5) scaleX(1.2)'
                            : '',
                        left: '60%',
                        top: '35px',
                    }}
                />
                <img
                    src="/creeper_eye.svg"
                    className="w-1 h-1 absolute transition-transform"
                    alt="eye"
                    style={{
                        transform: blinkAnimationTriggered
                            ? 'scaleY(0.5) scaleX(1.2)'
                            : '',
                        left: '70%',
                        top: '35px',
                    }}
                />
                <img src="/creeper.svg" alt="" className="cursor-pointer" />
            </div>
        </div>
    );
};
