import '@ens-tools/thorin-core/style.css';
export default function () {
    return (
        <>
            <section className="bg-ens-light-blue-light dark:bg-ens-dark-blue-surface h-48 flex justify-center items-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Welcome to ENS Page</h1>
                    <p>Your personal link site, for your decentralized name.</p>
                </div>
            </section>
            <section className="flex justify-center items-center">
                <div className="mt-6">
                    <h2>View your ENS name</h2>
                    <form action={'/query'}>
                        <input
                            type="text"
                            name="name"
                            placeholder="ens.eth"
                            className="p-2 dark:bg-ens-dark-grey-surface bg-ens-light-grey-surface outline-ens-dark-blue-surface border border-black dark:border-neutral-500 rounded-lg rounded-r-none border-r-0"
                        ></input>
                        <button
                            type="submit"
                            className="p-2 dark:bg-ens-dark-blue-light bg-ens-light-blue-light rounded-lg rounded-l-none"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </section>
        </>
    );
}
