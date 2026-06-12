export const SHOW_POAP_ANYWAYS = false;

export const getTextFromInfo = (
    profile: string,
    event_slug: string,
    event: string
) => {
    if (['frensday2023', 'ethdenver2024'].includes(event_slug))
        return (
            <span>
                Mint a POAP to show you met {profile} at {event}!
            </span>
        );

    return <span>Mint a POAP!</span>;
};
