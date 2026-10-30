import { Crown } from "lucide-react";
import "./../styles/void.css";

/** Account ID владельца проекта; плашка рисуется только в его профиле. */
export const OWNER_ID = 1483539762;

export default function OwnerBadge({ accountId }: { accountId: number | string }) {
  if (String(accountId) !== String(OWNER_ID)) return null;
  return (
    <span className="owner-chip" data-tip="Owner и CEO проекта VOID — он же создатель, он же единственный сотрудник, он же техподдержка" tabIndex={0}>
      <Crown size={13} strokeWidth={2.4} aria-hidden="true" />
      OWNER
    </span>
  );
}
