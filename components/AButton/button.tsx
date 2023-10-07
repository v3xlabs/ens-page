import { FC, PropsWithChildren } from 'react';

export const AButton: FC<PropsWithChildren<{ href: string }>> = ({
    children,
    href,
}) => {
    return (
        <a href={href} target="_blank" className="btn px-4 py-3">
            {children}
        </a>
    );
};
