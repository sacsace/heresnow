import { DoorFacePreloader } from "@/components/door/DoorFacePreloader";
import { DoorTerminal } from "@/components/door/DoorTerminal";
import { requireDoorSession } from "@/lib/requireDoorRole";

export default async function DoorPage() {
  await requireDoorSession();
  return (
    <>
      <DoorFacePreloader />
      <DoorTerminal />
    </>
  );
}
