import { Show } from "solid-js";

import { useNameRegistrant } from "../hooks/useNameRegistrant";
import { ENSFAIRY_ADDRESS, ENSFAIRY_NAME } from "../utils/ens";
import { NameAvatar } from "./name-avatar";

/** A cute marker on names held by ensfairy.eth: the fairy keeps donated names
 * safe, so this one is available — reach out to adopt it. */
export const EnsfairyBadge = (properties: { name: string; }) => {
  const registrant = useNameRegistrant(() => properties.name);

  return (
    <Show when={registrant.data?.toLowerCase() === ENSFAIRY_ADDRESS.toLowerCase()}>
      <span
        class="inline-flex shrink-0"
        data-testid={`fairy-badge-${properties.name}`}
        title="Held by ensfairy.eth 🧚 — this name is available; reach out to the fairy to adopt it."
      >
        <NameAvatar name={ENSFAIRY_NAME} />
      </span>
    </Show>
  );
};
