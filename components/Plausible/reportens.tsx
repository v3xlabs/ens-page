'use client';

import React, { useEffect } from 'react';

import { IYKRefResponse as IYKReferenceResponse } from '../../hooks/useIYKRef';

// Define the types for the props
interface Properties {
    event?: string;
    iykData?: IYKReferenceResponse;
}

// Define the functional component
const ReportENSCard: React.FC<Properties> = ({ event, iykData }) => {
    useEffect(() => {
        // eslint-disable-next-line no-undef
        const { plausible } = window as any;

        if (!iykData.uid) {
            return;
        }

        plausible('ENS Card', {
            props: {
                event: event || 'No event',
                ENSCard: '123',
            },
        });
    }, [event, iykData]);

    return <></>;
};

export default ReportENSCard;
