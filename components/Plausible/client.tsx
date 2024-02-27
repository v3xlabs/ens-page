'use client';

import React, { useEffect } from 'react';

import { IYKRefResponse as IYKReferenceResponse } from '../../hooks/useIYKRef';

// Define the types for the props
interface Properties {
    event?: string;
    iykData?: IYKReferenceResponse;
}

// Define the functional component
const ClientPlausible: React.FC<Properties> = ({ event, iykData }) => {
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        // @ts-ignore
        // eslint-disable-next-line no-undef
        const { plausible, location } = window;

        const searchParameters = new URLSearchParams(location.search);

        if (iykData?.isValidRef && iykData?.uid) {
            searchParameters.set('utm_source', 'Scanned ENS Cards');
            searchParameters.set('utm_term', 'ENS Card - ' + iykData?.uid);
            searchParameters.delete('iykRef');
        }

        if (event) {
            searchParameters.set('utm_campaign', event);
        }

        plausible('pageview', {
            u: location.href,
            props: {
                ENSCard: iykData?.uid || undefined,
                event: event || undefined,
            },
            // eslint-disable-next-line no-undef
            r: document.referrer,
        });
    }, [event, iykData]);

    return <></>;
};

export default ClientPlausible;
