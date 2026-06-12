type ErrorResponse = {
    error: 'Bad Request';
    message: 'You already minted a POAP for this drop.';
    statusCode: 400;
};

export const mintPOAP = async (
    otpCode: string,
    recipient: string,
    poapEventId: number
) => {
    const headers = new Headers();

    headers.append('Content-Type', 'application/json');
    headers.append('x-iyk-code', otpCode);

    const response = await fetch('https://api.iyk.app/poap-events/mint', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            recipient,
            poapEventId,
        }),
    });

    if (!response.ok) {
        if (response.status == 400) {
            const error: ErrorResponse = await response.json();

            return [undefined, error];
        }

        return [undefined, response];
    }

    const data = await response.json();

    return [data, undefined];
};
