
// This route is needed in order not to use the client side forms on the index
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    if (!searchParams.has('name')) {
        return Response.redirect('https://ens.page');
    }

    return Response.redirect('https://ens.page/' + searchParams.get('name'));
}
