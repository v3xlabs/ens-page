export const EventHeader = ({ event }) => {
    if (event == 'frensday2023') {
        return (
            <div className="text-center px-4">
                <img
                    src="/frensday_2.svg"
                    alt="frensday"
                    className="w-full h-auto mx-auto"
                />
                <div>November 13 2023, Istanbul Türkiye</div>
            </div>
        );
    }

    if (event == 'ethdenver2024') {
        return (
            <div className="px-6 w-full">
                <img
                    src="/ethdenver24/header.svg"
                    alt="ethdenver"
                    className="w-full h-auto mx-auto"
                />
            </div>
        );
    }

    if (event == 'frensday2024') {
        return (
            <div className="px-6 w-[80%] mx-auto">
                <img
                    src="/frensday-logo.svg"
                    alt="frensday"
                    className="w-full h-auto mx-auto"
                />
            </div>
        );
    }

    return <></>;
};
