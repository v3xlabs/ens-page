export const PendingApproval = () => {
    return (
        <div>
            This POAP is still{' '}
            <a
                href="https://blog.poap.xyz/guidelines/"
                target="_blank"
                className="text-ens-light-blue-primary underline"
            >
                pending human review
            </a>
            . This can take up to ~1 hour. Please try again later.
        </div>
    );
};
