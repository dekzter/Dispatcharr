import { useCallback } from "react";
import type { Route } from "./+types/channels";
import { Allotment } from "allotment";
import ChannelsTable from "./channels/ChannelsTable";
import storage from "~/lib/safe-storage";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings - Dispatcharr" },
    { name: "description", content: "Manage your settings" },
  ];
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex h-full w-full">
      Settings page coming soon!
    </div>
  );
}
