import { useCallback, useRef } from "react";
import type { Route } from "./+types/channels";
import { Allotment } from "allotment";
import ChannelsTable from "./channels/ChannelsTable";
import storage from "~/lib/safe-storage";
import { getBaseUrl } from "~/lib/urls";
import {USER_LEVELS} from '~/lib/constants'
import useAuthStore from "~/store/auth";
import useLogosStore from '~/store/logos'

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Channels - Dispatcharr" },
    { name: "description", content: "Manage your channels" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  // Extract base URLs from the request (works server-side AND client-side)
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

  const channelsReady = useRef(false);
  const streamsReady = useRef(false);
  const logosTriggered = useRef(false);

  // const [allotmentSizes, setAllotmentSizes] = useLocalStorage(
  //   'channels-splitter-sizes',
  //   [50, 50]
  // );

  // Only load logos when BOTH tables are ready
  const tryLoadLogos = useCallback(() => {
    if (
      channelsReady.current &&
      streamsReady.current &&
      !logosTriggered.current
    ) {
      logosTriggered.current = true;
      // Use requestAnimationFrame to defer logo loading until after browser paint
      // This ensures EPG column is fully rendered before logos start loading
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

  // @TODO-v2: remove when streams table implemented
  handleStreamsReady()

  // const handleSplitChange = (sizes) => {
  //   setAllotmentSizes(sizes);
  // };

  // const handleResize = (sizes) => {
  //   setAllotmentSizes(sizes);
  // };

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
        <ChannelsTable onReady={handleChannelsReady} />
        </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      <Allotment
        defaultSizes={defaultSizes}
        onChange={handleSplitChange}
        className="h-full w-full"
      >
        <Allotment.Pane minSize={300}>
          <div className="flex h-full flex-col p-2">
            <ChannelsTable onReady={handleChannelsReady} />
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={300}>
          <div className="flex h-full flex-col p-2">
            {/* <ChannelsTable/> */}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}
