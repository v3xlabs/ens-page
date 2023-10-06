type WarpcastProfile = {
    fid: number;
    username: string;
    displayName: string;
    pfp: {
        url: string;
        verified: boolean;
    };
    profile: {
        bio: {
            text: string;
            mentions: [];
        };
        location: {
            placeId: string;
            description: string;
        };
    };
    followerCount: number;
    followingCount: number;
    activeOnFcNetwork: boolean;
    referrerUsername: string;
    viewerContext: {
        following: boolean;
        followedBy: boolean;
        canSendDirectCasts: boolean;
        hasUploadedInboxKeys: boolean;
    };
};

type WarpcastResponse = {
    result?: {
        user: WarpcastProfile;
        inviter: WarpcastProfile;
        inviterIsReferrer: boolean;
        collectionsOwned: [];
    };
};

export const useWarpcast = async (name: string): Promise<WarpcastResponse> => {
    try {
        const request = await fetch(
            `https://client.warpcast.com/v2/user-by-username?username=${name}`
        );

        const response: WarpcastResponse = await request.json();

        return response;
    } catch {
        //
    }

    return { result: undefined };
};
