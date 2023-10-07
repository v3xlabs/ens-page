const FALLBACK_DATA = {
    name: 'luc.eth',
    address: '0x225f137127d9067788314bc7fcc1f36746a3c3B5',
    avatar: 'https://ens.xyz/luc.eth',
    display: 'luc.eth',
    records: {
        'com.discord': 'lucemans',
        'com.github': 'lucemans',
        'com.twitter': 'lucemansnl',
        description: 'Create Epic Shit',
        email: 'luc@lucemans.nl',
        location: 'Breda, NL',
        name: 'luc',
        'org.telegram': 'lucemans',
        timezone: 'Etc/UTC',
        url: 'https://luc.computer',
    },
    chains: {
        eth: '0x225f137127d9067788314bc7fcc1f36746a3c3B5',
    },
    fresh: 1_696_518_163_749,
    resolver: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41',
    errors: {},
};

export type EnstateResponse = typeof FALLBACK_DATA;

export const useEnstate = async (name: string) => {
    const http = await fetch(`https://enstate.rs/n/${name}`);

    const data: EnstateResponse = await http.json();

    return data;
};
