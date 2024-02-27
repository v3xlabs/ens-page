'use client';

import React from 'react';

import { IYKRefResponse as IYKReferenceResponse } from '../../hooks/useIYKRef';

// Define the types for the props
interface MyComponentProperties {
    slug?: string;
    event?: string;
    iykData?: IYKReferenceResponse;
}

// Define the functional component
const ClientPlausible: React.FC<MyComponentProperties> = ({
    slug,
    event,
    iykData,
}) => {
    if (typeof window === 'undefined') {
        return <></>;
    }

    // @ts-ignore
    // eslint-disable-next-line no-undef
    const { plausible } = window;

    if (iykData.isValidRef && iykData.uid) {
        // TODO: Actually log the data here please
        plausible('pageview');
    }

    console.log({
        slug,
        event,
        iykData,
    });

    return <></>;
};

export default ClientPlausible;
