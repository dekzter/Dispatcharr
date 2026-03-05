import { useCallback, useRef, useState } from "react";
import type { Route } from "./+types/channels";
import ChannelsTable from "./channels/ChannelsTable";
import StreamsTable from "./channels/StreamsTable";
import storage from "@/lib/safe-storage";
import { getBaseUrl } from "@/lib/urls";
import {USER_LEVELS} from '@/lib/constants'
import useAuthStore from "@/store/auth";
import useLogosStore from '@/store/logos'
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Channels - Dispatcharr" },
    { name: "description", content: "Manage your channels" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  return {
    baseUrl: getBaseUrl(request),
  };
}

export default function Channels({ loaderData }: Route.ComponentProps) {
  const authUser = useAuthStore((s) => s.user);
  const fetchChannelAssignableLogos = useLogosStore(
    (s) => s.fetchChannelAssignableLogos
  );
  const enableLogoRendering = useLogosStore((s) => s.enableLogoRendering);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"channels" | "streams">("channels");

  const channelsReady = useRef(false);
  const streamsReady = useRef(false);
  const logosTriggered = useRef(false);

  const tryLoadLogos = useCallback(() => {
    if (
      channelsReady.current &&
      streamsReady.current &&
      !logosTriggered.current
    ) {
      logosTriggered.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          enableLogoRendering();
          fetchChannelAssignableLogos();
        });
      });
    }
  }, [fetchChannelAssignableLogos, enableLogoRendering]);

  const handleChannelsReady = useCallback(() => {
    channelsReady.current = true;
    tryLoadLogos();
  }, [tryLoadLogos]);

  const handleStreamsReady = useCallback(() => {
    streamsReady.current = true;
    tryLoadLogos();
  }, [tryLoadLogos]);

    const defaultSizes = storage.getJSON<number[]>("channels-splitter-sizes") || [
    50, 50,
  ];

  const handleSplitChange = useCallback((sizes: number[]) => {
    storage.setJSON("channels-splitter-sizes", sizes);
  }, []);

  if (!authUser.id) return <></>;

  if (authUser.user_level <= USER_LEVELS.STANDARD) {
    handleStreamsReady();
    return (
      <div className="flex h-full w-full">
        <ChannelsTable onReady={handleChannelsReady} baseUrl={loaderData.baseUrl}/>
        </div>
    );
  }

  return (
    <>
      {/* Mobile: tab toggle, both panels stay mounted */}
      {isMobile ? (
        <div className="flex h-full w-full max-w-full flex-col">
          <div className="flex shrink-0 border-b">
            <button
              onClick={() => setActiveTab("channels")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === "channels"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Channels
            </button>
            <button
              onClick={() => setActiveTab("streams")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                activeTab === "streams"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Streams
            </button>
          </div>
          <div className={`flex h-full min-h-0 flex-col p-2 ${activeTab === "channels" ? "" : "hidden"}`}>
            <ChannelsTable onReady={handleChannelsReady} baseUrl={loaderData.baseUrl} />
          </div>
          <div className={`flex h-full min-h-0 flex-col p-2 ${activeTab === "streams" ? "" : "hidden"}`}>
            <StreamsTable onReady={handleStreamsReady} />
          </div>
        </div>
      ) : (
        /* Desktop: resizable split panels */
        <ResizablePanelGroup
          orientation="horizontal"
          className="w-full rounded-lg border"
        >
          <ResizablePanel defaultSize="50%">
            <div className="flex h-full flex-col p-2">
              <ChannelsTable onReady={handleChannelsReady} baseUrl={loaderData.baseUrl} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="50%">
            <div className="flex h-full flex-col p-2">
              <StreamsTable onReady={handleStreamsReady} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </>
  )
}
