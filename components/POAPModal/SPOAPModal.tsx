import { FC } from 'react';

import { IYKRefResponse as IYKReferenceResponse } from '../../hooks/useIYKRef';
import { usePOAPData } from '../../hooks/usePOAPData';
import { POAPModal } from './POAPModal';

export const SPOAPModal: FC<{
    data: IYKReferenceResponse;
    name: string;
    event: string;
}> = async ({ data, name, event }) => {
    if (data.poapEvents.length === 0) return;

    const [iyk_poap_event_data] = data.poapEvents;

    const metadata = await usePOAPData(iyk_poap_event_data.poapEventId);

    if (!metadata) return;

    return (
        <POAPModal data={data} name={name} metadata={metadata} event={event} />
    );
};
