const POAP_API_HOST = 'https://api.poap.tech';

export type POAPMetadata = {
    description: string;
    external_url: string;
    home_url: string;
    image_url: string;
    name: string;
    year: number;
    tags: string[];
    attributes: {
        trait_type: string;
        value: string;
    }[];
};

export const usePOAPData = async (
    poapEventId: number
): Promise<POAPMetadata | undefined> => {
    try {
        const request = await fetch(`${POAP_API_HOST}/metadata/${poapEventId}/1`);

        if (!request.ok) return;

        return await request.json();
    } catch (erorr) {
        console.error('Error fetching POAP data', erorr);
    }
};
