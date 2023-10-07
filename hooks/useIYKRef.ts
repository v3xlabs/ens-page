/* eslint-disable unicorn/prevent-abbreviations */

type IYKPOAPEvent = {
    id: number;
    poapEventId: number;
    otp: string;
    status: 'expired';
};

type IYKLinkedToken = {
    contractAddress: string;
    chainId: number;
    tokenId: string;
};

export type IYKRefResponse = {
    uid: string;
    isValidRef: boolean;
    poapEvents: IYKPOAPEvent[];
    linkedToken: IYKLinkedToken;
};

const DEBUG_VALUE = {
    uid: '1304147270046608',
    isValidRef: true,
    poapEvents: [
        {
            id: 22_278,
            poapEventId: 127_866,
            otp: '7AalDLzTKE92NMLRlPquu',
            status: 'expired',
        },
    ],
    linkedToken: {
        contractAddress: '0x6b26ca239e522ac80d636aafd61d339a90ca694d',
        chainId: 137,
        tokenId: '12971',
    },
};

export const useIYKRef = async (reference?: string) => {
    if (!reference) return;

    const headers = new Headers();

    headers.append('x-api-key', process.env.IYK_API_KEY);

    const response = await fetch('https://api.iyk.app/refs/' + reference, {
        headers,
    });

    if (!response.ok) return;

    const result: IYKRefResponse = await response.json();

    return DEBUG_VALUE as IYKRefResponse;
    // return result;
};
