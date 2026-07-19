import { useQueryClient } from "@tanstack/solid-query";
import { type Accessor, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";
import { formatEther } from "viem/utils";

import { type PoolStream, prepareClaimStream } from "../hooks/usePoolAdapters";
import { useTransaction } from "../hooks/useTransaction";
import { shortenAddress } from "../utils/ens";
import { findKnownToken, formatTokenAmount, tokenLabel } from "../utils/tokens";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

type PoolStreamsCardProperties = {
  onClaimed: () => void;
  streamAdapter: Accessor<Address | undefined>;
  streams: PoolStream[];
};

const formatStreamAmount = (stream: PoolStream, value: bigint): string => {
  if (stream.token === "0x0000000000000000000000000000000000000000") {
    return `${Number(formatEther(value)).toFixed(4)} ETH`;
  }

  const token = findKnownToken(stream.token);

  return `${token ? formatTokenAmount(value, token.decimals) : String(value)} ${tokenLabel(stream.token)}`;
};

const isStreamActive = (stream: PoolStream): boolean => Date.now() / 1000 < stream.stopTime;

export const PoolStreamsCard = (properties: PoolStreamsCardProperties) => {
  const queryClient = useQueryClient();
  const transaction = useTransaction();
  const [isReviewOpen, setIsReviewOpen] = createSignal(false);
  const [reviewSummary, setReviewSummary] = createSignal<TransactionSummaryRow[]>([]);
  const [pendingStreamId, setPendingStreamId] = createSignal<bigint>();

  const openClaim = (stream: PoolStream) => {
    setPendingStreamId(stream.streamId);
    setReviewSummary([
      { label: "Action", value: "Claim accrued stream funds into the pool" },
      { label: "From", value: shortenAddress(stream.payer) },
      { label: "Accrued", value: formatStreamAmount(stream, stream.accrued) },
    ]);
    transaction.preview();
    setIsReviewOpen(true);
  };

  const confirmClaim = async () => {
    const adapter = properties.streamAdapter();
    const streamId = pendingStreamId();

    if (!adapter || streamId === undefined) return;

    const hash = await transaction.send(prepareClaimStream(adapter, streamId));

    if (!hash) return;

    await queryClient.invalidateQueries({ queryKey: ["poolStreams"] });
    properties.onClaimed();
  };

  const closeClaim = () => {
    setIsReviewOpen(false);
    setPendingStreamId();
    transaction.reset();
  };

  return (
    <Show when={properties.streams.length > 0}>
      <section class="card p-5" data-testid="pool-streams">
        <h3 class="text-lg font-bold">Streams</h3>
        <p class="mt-1 text-sm text-text-secondary">
          Vesting into this pool — anyone can push the accrued portion onward.
        </p>

        <div class="mt-2">
          <For each={properties.streams}>
            {stream => (
              <div class="flex flex-wrap items-center gap-3 border-b border-border py-2.5 text-sm last:border-b-0">
                <div class="min-w-0 flex-1">
                  <p class="font-bold tabular-nums">
                    {formatStreamAmount(stream, stream.totalAmount)}
                    {" "}
                    <span class="font-normal text-text-secondary">
                      from
                      {" "}
                      {shortenAddress(stream.payer)}
                    </span>
                  </p>
                  <p class="text-xs text-text-secondary tabular-nums">
                    {isStreamActive(stream) ? "streaming" : "ended"}
                    {" · "}
                    {formatStreamAmount(stream, stream.claimed)}
                    {" "}
                    claimed
                  </p>
                </div>
                <Show when={stream.accrued > 0n}>
                  <button
                    class="button subtle"
                    data-testid={`stream-claim-${stream.streamId}`}
                    onClick={() => openClaim(stream)}
                    type="button"
                  >
                    Claim
                    {" "}
                    {formatStreamAmount(stream, stream.accrued)}
                  </button>
                </Show>
              </div>
            )}
          </For>
        </div>

        <TransactionModal
          isOpen={isReviewOpen()}
          onClose={closeClaim}
          onConfirm={() => void confirmClaim()}
          state={transaction.state()}
          summary={reviewSummary()}
          title="Claim stream"
        />
      </section>
    </Show>
  );
};
