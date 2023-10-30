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

    return <></>;
};
