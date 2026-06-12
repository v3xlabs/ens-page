import clsx from 'clsx';
import { FC, PropsWithChildren } from 'react';

export const AButton: FC<
    PropsWithChildren<{ href: string; className?: string }>
> = ({ children, href, className }) => {
    return (
        <a
            href={href}
            target="_blank"
            className={clsx('btn px-4 py-3', className)}
        >
            {children}
        </a>
    );
};
