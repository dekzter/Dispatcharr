import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card.js';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import API from '@/lib/api.js';
import {
  format,
  getNow,
  initializeTime,
  subtract,
  toFriendlyDuration,
  useDateTimeFormat,
} from '@/lib/date-time.js';
import { formatBytes, formatSpeed } from '@/lib/network';
import toast from '@/lib/toast.js';
import useVideoStore from '@/store/useVideoStore';
import {
  CirclePlay,
  Gauge,
  HardDriveDownload,
  HardDriveUpload,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import usePlaylistsStore from '../../store/playlists.jsx';
import useSettingsStore from '../../store/settings.jsx';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// Get buffering_speed from proxy settings
export const getBufferingSpeedThreshold = (proxySetting) => {
  try {
    if (proxySetting?.value) {
      return parseFloat(proxySetting.value.buffering_speed) || 1.0;
    }
  } catch (error) {
    console.error('Error getting buffering speed:', error);
  }
  return 1.0; // Default fallback
};

export const getStartDate = (uptime) => {
  // Get the current date and time
  const currentDate = new Date();
  // Calculate the start date by subtracting uptime (in milliseconds)
  const startDate = new Date(currentDate.getTime() - uptime * 1000);
  // Format the date as a string (you can adjust the format as needed)
  return startDate.toLocaleString({
    weekday: 'short', // optional, adds day of the week
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true, // 12-hour format with AM/PM
  });
};

export const getM3uAccountsMap = (m3uAccounts) => {
  const map = {};
  if (m3uAccounts && Array.isArray(m3uAccounts)) {
    m3uAccounts.forEach((account) => {
      if (account.id) {
        map[account.id] = account.name;
      }
    });
  }
  return map;
};

export const getChannelStreams = async (channelId) => {
  return await API.getChannelStreams(channelId);
};

export const getMatchingStreamByUrl = (streamData, channelUrl) => {
  return streamData.find(
    (stream) =>
      channelUrl.includes(stream.url) || stream.url.includes(channelUrl)
  );
};

export const getSelectedStream = (availableStreams, streamId) => {
  return availableStreams.find((s) => s.id.toString() === streamId);
};

export const switchStream = (channel, streamId) => {
  return API.switchStream(channel.channel_id, streamId);
};

export const connectedAccessor = (fullDateTimeFormat) => {
  return (row) => {
    // Check for connected_since (which is seconds since connection)
    if (row.connected_since) {
      // Calculate the actual connection time by subtracting the seconds from current time
      const connectedTime = subtract(getNow(), row.connected_since, 'second');
      return format(connectedTime, fullDateTimeFormat);
    }

    // Fallback to connected_at if it exists
    if (row.connected_at) {
      const connectedTime = initializeTime(row.connected_at * 1000);
      return format(connectedTime, fullDateTimeFormat);
    }

    return 'Unknown';
  };
};

export const durationAccessor = () => {
  return (row) => {
    if (row.connected_since) {
      return toFriendlyDuration(row.connected_since, 'seconds');
    }

    if (row.connection_duration) {
      return toFriendlyDuration(row.connection_duration, 'seconds');
    }

    return '-';
  };
};

export const getLogoUrl = (logoId, logos, previewedStream) => {
  return (
    (logoId && logos && logos[logoId] ? logos[logoId].cache_url : null) ||
    previewedStream?.logo_url ||
    null
  );
};

export const getStreamsByIds = (streamId) => {
  return API.getStreamsByIds([streamId]);
};

export const getStreamOptions = (availableStreams, m3uAccountsMap) => {
  return availableStreams.map((stream) => {
    // Get account name from our mapping if it exists
    const accountName =
      stream.m3u_account && m3uAccountsMap[stream.m3u_account]
        ? m3uAccountsMap[stream.m3u_account]
        : stream.m3u_account
          ? `M3U #${stream.m3u_account}`
          : 'Unknown M3U';

    return {
      value: stream.id.toString(),
      label: `${stream.name || `Stream #${stream.id}`} [${accountName}]`,
    };
  });
};

// Create a separate component for each channel card to properly handle the hook
const StreamConnectionCard = ({
  channel,
  clients,
  stopClient,
  stopChannel,
  logos,
  channelsByUUID,
  channels,
  currentProgram,
}) => {
  const location = useLocation();
  const [availableStreams, setAvailableStreams] = useState([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [currentM3UProfile, setCurrentM3UProfile] = useState(null); // Add state for current M3U profile
  const [data, setData] = useState([]);
  const [previewedStream, setPreviewedStream] = useState(null);
  const [isProgramDescExpanded, setIsProgramDescExpanded] = useState(false);

  // Get M3U account data from the playlists store
  const m3uAccounts = usePlaylistsStore((s) => s.playlists);
  // Get settings for speed threshold and environment mode
  const settings = useSettingsStore((s) => s.settings);
  const env_mode =
    useSettingsStore((s) => s.environment?.env_mode) || 'production';
  // Get video preview function
  const showVideo = useVideoStore((s) => s.showVideo);

  // Get user's date/time format preferences
  const { fullDateTimeFormat } = useDateTimeFormat();

  // Create a map of M3U account IDs to names for quick lookup
  const m3uAccountsMap = useMemo(() => {
    return getM3uAccountsMap(m3uAccounts);
  }, [m3uAccounts]);

  // Update M3U profile information when channel data changes
  useEffect(() => {
    // If the channel data includes M3U profile information, update our state
    if (channel.m3u_profile || channel.m3u_profile_name) {
      setCurrentM3UProfile({
        name:
          channel.m3u_profile?.name ||
          channel.m3u_profile_name ||
          'Default M3U',
      });
    }
  }, [channel.m3u_profile, channel.m3u_profile_name, channel.stream_id]);

  // Fetch available streams for this channel
  useEffect(() => {
    const fetchStreams = async () => {
      setIsLoadingStreams(true);
      try {
        // Get channel ID from UUID
        console.log('HERE');
        console.log(channelsByUUID);
        console.log(channel.channel_id);
        const channelId = channelsByUUID[channel.channel_id];
        if (channelId) {
          const streamData = await getChannelStreams(channelId);

          // Use streams in the order returned by the API without sorting
          setAvailableStreams(streamData);

          // If we have a channel URL, try to find the matching stream
          if (channel.url && streamData.length > 0) {
            // Try to find matching stream based on URL
            const matchingStream = getMatchingStreamByUrl(
              streamData,
              channel.url
            );

            if (matchingStream) {
              setActiveStreamId(matchingStream.id.toString());

              // If the stream has M3U profile info, save it
              if (matchingStream.m3u_profile) {
                setCurrentM3UProfile(matchingStream.m3u_profile);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching streams:', error);
      } finally {
        setIsLoadingStreams(false);
      }
    };

    fetchStreams();
  }, [channel.channel_id, channel.url, channelsByUUID]);

  useEffect(() => {
    setData(
      clients
        .filter((client) => client.channel.channel_id === channel.channel_id)
        .map((client) => ({
          id: client.client_id,
          ...client,
        }))
    );
  }, [clients, channel.channel_id]);

  // const renderHeaderCell = (header) => {
  //   switch (header.id) {
  //     default:
  //       return (
  //         <Group>
  //           <Text size="sm" name={header.id}>
  //             {header.column.columnDef.header}
  //           </Text>
  //         </Group>
  //       );
  //   }
  // };

  // const renderBodyCell = ({ cell, row }) => {
  //   switch (cell.column.id) {
  //     case 'actions':
  //       return (
  //         <Box sx={{ justifyContent: 'right' }}>
  //           <Center>
  //             <Tooltip label="Disconnect client">
  //               <ActionIcon
  //                 size="sm"
  //                 variant="transparent"
  //                 color="red.9"
  //                 onClick={() =>
  //                   stopClient(
  //                     row.original.channel.uuid,
  //                     row.original.client_id
  //                   )
  //                 }
  //               >
  //                 <SquareX size="18" />
  //               </ActionIcon>
  //           </Center>
  //         </Box>
  //       );
  //   }
  // };

  const checkStreamsAfterChange = (streamId) => {
    return async () => {
      try {
        const channelId = channelsByUUID[channel.channel_id];
        if (channelId) {
          const updatedStreamData = await getChannelStreams(channelId);
          console.log('Channel streams after switch:', updatedStreamData);

          // Update current stream information with fresh data
          const updatedStream = getSelectedStream(updatedStreamData, streamId);
          if (updatedStream?.m3u_profile) {
            setCurrentM3UProfile(updatedStream.m3u_profile);
          }
        }
      } catch (error) {
        console.error('Error checking streams after switch:', error);
      }
    };
  };

  // Handle stream switching
  const handleStreamChange = async (streamId) => {
    try {
      console.log('Switching to stream ID:', streamId);
      // Find the selected stream in availableStreams for debugging
      const selectedStream = getSelectedStream(availableStreams, streamId);
      console.log('Selected stream details:', selectedStream);

      // Make sure we're passing the correct ID to the API
      const response = await switchStream(channel, streamId);
      console.log('Stream switch API response:', response);

      // Update the local active stream ID immediately
      setActiveStreamId(streamId);

      // Update M3U profile information if available in the response
      if (response?.m3u_profile) {
        setCurrentM3UProfile(response.m3u_profile);
      } else if (selectedStream && selectedStream.m3u_profile) {
        // Fallback to the profile from the selected stream
        setCurrentM3UProfile(selectedStream.m3u_profile);
      }

      // Show detailed notification with stream name
      toast.show({
        title: 'Stream switching',
        message: `Switching to "${selectedStream?.name}" for ${channel.name}`,
        color: 'blue.5',
      });

      // After a short delay, fetch streams again to confirm the switch
      setTimeout(checkStreamsAfterChange(streamId), 2000);
    } catch (error) {
      console.error('Stream switch error:', error);
      toast.show({
        title: 'Error switching stream',
        message: error.toString(),
        color: 'red.5',
      });
    }
  };

  // const clientsColumns = useMemo(
  //   () => [
  //     {
  //       id: 'expand',
  //       size: 20,
  //     },
  //     {
  //       header: 'IP Address',
  //       accessorKey: 'ip_address',
  //       size: 150,
  //       cell: ({ cell }) => (
  //         <Tooltip label={cell.getValue()}>
  //           <Text size="xs" truncate style={{ maxWidth: '100%' }}>
  //             {cell.getValue()}
  //           </Text>
  //       ),
  //     },
  //     // Updated Connected column with tooltip
  //     {
  //       id: 'connected',
  //       header: 'Connected',
  //       accessorFn: connectedAccessor(fullDateTimeFormat),
  //       cell: ({ cell }) => (
  //         <Tooltip
  //           label={
  //             cell.getValue() !== 'Unknown'
  //               ? `Connected at ${cell.getValue()}`
  //               : 'Unknown connection time'
  //           }
  //         >
  //           <Text size="xs">{cell.getValue()}</Text>
  //       ),
  //     },
  //     // Update Duration column with tooltip showing exact seconds
  //     {
  //       id: 'duration',
  //       header: 'Duration',
  //       accessorFn: durationAccessor(),
  //       cell: ({ cell, row }) => {
  //         const exactDuration =
  //           row.original.connected_since || row.original.connection_duration;
  //         return (
  //           <Tooltip
  //             label={
  //               exactDuration
  //                 ? `${exactDuration.toFixed(1)} seconds`
  //                 : 'Unknown duration'
  //             }
  //           >
  //             <Text size="xs">{cell.getValue()}</Text>
  //         );
  //       },
  //     },
  //     {
  //       id: 'actions',
  //       header: 'Actions',
  //       size: 100,
  //     },
  //   ],
  //   [fullDateTimeFormat]
  // );

  //   const channelClientsTable = useTable({
  //     ...TableHelper.defaultProperties,
  //     columns: clientsColumns,
  //     data,
  //     allRowIds: data.map((client) => client.id),
  //     tableCellProps: () => ({
  //       padding: 4,
  //       borderColor: '#444',
  //       color: '#E0E0E0',
  //       fontSize: '0.85rem',
  //     }),
  //     headerCellRenderFns: {
  //       ip_address: renderHeaderCell,
  //       connected: renderHeaderCell,
  //       duration: renderHeaderCell,
  //       actions: renderHeaderCell,
  //     },
  //     bodyCellRenderFns: {
  //       actions: renderBodyCell,
  //     },
  //     getExpandedRowHeight: (row) => {
  //       return 20 + 28 * row.original.streams.length;
  //     },
  //     expandedRowRenderer: ({ row }) => {
  //       return (
  //         <Box p="xs">
  //           <Group spacing="xs" align="flex-start">
  //             <Text size="xs" fw={500} color="dimmed">
  //               User Agent:
  //             </Text>
  //             <Text size="xs">{row.original.user_agent || 'Unknown'}</Text>
  //           </Group>
  //         </Box>
  //       );
  //     },
  //     mantineExpandButtonProps: ({ row, table }) => ({
  //       size: 'xs',
  //       style: {
  //         transform: row.getIsExpanded() ? 'rotate(180deg)' : 'rotate(-90deg)',
  //         transition: 'transform 0.2s',
  //       },
  //     }),
  //     displayColumnDefOptions: {
  //       'mrt-row-expand': {
  //         size: 15,
  //         header: '',
  //       },
  //       'mrt-row-actions': {
  //         size: 74,
  //       },
  //     },
  //   });

  // Get logo URL from the logos object if available
  const logoUrl = getLogoUrl(channel.logo_id, logos, previewedStream);

  useEffect(() => {
    let isMounted = true;
    // Only fetch if we have a stream_id and NO channel.name
    if (!channel.name && channel.stream_id) {
      getStreamsByIds(channel.stream_id).then((streams) => {
        if (isMounted && streams && streams.length > 0) {
          setPreviewedStream(streams[0]);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [channel.name, channel.stream_id]);

  const channelName =
    channel.name || previewedStream?.name || 'Unnamed Channel';
  const uptime = channel.uptime || 0;
  const [liveUptime, setLiveUptime] = useState(uptime || 0);

  useEffect(() => {
    setLiveUptime(uptime || 0);
  }, [uptime]);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveUptime((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatLiveUptime = (secs) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    if (hours > 0) return `${hours}:${minutes}:${seconds}`;
    if (minutes > 0) return `${minutes}:${seconds}`;
    return `00:${seconds}`;
  };
  const bitrates = channel.bitrates || [];
  const totalBytes = channel.total_bytes || 0;
  const clientCount = channel.client_count || 0;
  const avgBitrate = channel.avg_bitrate || '0 Kbps';
  const streamProfileName = channel.stream_profile?.name || 'Unknown Profile';

  // Use currentM3UProfile if available, otherwise fall back to channel data
  const m3uProfileName =
    currentM3UProfile?.name ||
    channel.m3u_profile?.name ||
    channel.m3u_profile_name ||
    'Unknown M3U Profile';

  // Create select options for available streams
  const streamOptions = getStreamOptions(availableStreams, m3uAccountsMap);

  // Handle preview channel button click
  const handlePreviewChannel = () => {
    const channelDbId = channelsByUUID[channel.channel_id];
    if (!channelDbId) return;

    const actualChannel = channels[channelDbId];
    if (!actualChannel?.uuid) return;

    const uri = `/proxy/ts/stream/${actualChannel.uuid}`;
    let url = `${window.location.protocol}//${window.location.host}${uri}`;
    if (env_mode === 'dev') {
      url = `${window.location.protocol}//${window.location.hostname}:5656${uri}`;
    }

    showVideo(url);
  };

  if (location.pathname !== '/stats') {
    return <></>;
  }

  // Safety check - if channel doesn't have required data, don't render
  if (!channel || !channel.channel_id) {
    return null;
  }

  return (
    <Card className="relative card-hover">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl"
        style={{ backgroundImage: `url("${logoUrl || '/logo.png'}")` }}
      ></div>
      <CardContent className="relative">
        <div className="relative flex justify-between space-x-4">
          <div className="relative h-30 w-22 flex-shrink-0 overflow-hidden rounded-lg shadow-lg">
            <img
              className="w-full h-full object-contain rounded"
              src={logoUrl || '/logo.png'}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                // objectFit: 'contain',
              }}
              alt="channel logo"
            />
          </div>

          <div className="flex flex-1 flex-col justify-start">
            <div className="flex justify-between items-center">
              <div className="font-bold text-sm">{channelName}</div>

              <div className="flex items-center">
                <div className="flex align-right font-light text-xs">
                  {formatLiveUptime(liveUptime)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="!bg-transparent cursor-pointer"
                  onClick={() => stopChannel(channel.channel_id)}
                >
                  <X />
                </Button>
              </div>
            </div>

            <div className="flex gap-1">
              <Badge>
                <Video size={15} />
                {streamProfileName}
              </Badge>
              <Badge>
                <HardDriveUpload size={15} />
                {m3uProfileName}
              </Badge>
            </div>

            <div className="flex pt-2 gap-2 items-center">
              <div className="space-y-1 w-full">
                <Label htmlFor="active-stream" className="text-xs">
                  Active Stream
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={
                      activeStreamId || channel.stream_id?.toString() || null
                    }
                    onValueChange={() => {
                      console.log(arguments);
                      // handleStreamChange
                    }}
                  >
                    <SelectTrigger id="active-stream" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {streamOptions.map((option) => {
                        console.log(option);
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <div
                    role="button"
                    className="cursor-pointer text-[var(--success)]"
                    onClick={handlePreviewChannel}
                  >
                    <CirclePlay size={24} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1 pt-4">
          {channel.resolution && (
            <Badge className="bg-red-200 text-red-900 dark:bg-red-900/30 dark:text-red-200">
              {channel.resolution}
            </Badge>
          )}
          {channel.source_fps && (
            <Badge className="bg-orange-200 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200">
              {channel.source_fps} FPS
            </Badge>
          )}
          {channel.video_codec && (
            <Badge className="bg-blue-200 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200">
              {channel.video_codec.toUpperCase()}
            </Badge>
          )}
          {channel.audio_codec && (
            <Badge className="bg-pink-200 text-pink-900 dark:bg-pink-900/30 dark:text-pink-200">
              {channel.audio_codec.toUpperCase()}
            </Badge>
          )}
          {channel.audio_channels && (
            <Badge className="bg-pink-200 text-pink-900 dark:bg-pink-900/30 dark:text-pink-200">
              {channel.audio_channels}
            </Badge>
          )}
          {channel.stream_type && (
            <Badge className="bg-cyan-200 text-cyan-900 dark:bg-cyan-900/30 dark:text-cyan-200">
              {channel.stream_type.toUpperCase()}
            </Badge>
          )}
          {channel.ffmpeg_speed && (
            <Badge
              className={
                parseFloat(channel.ffmpeg_speed) >=
                getBufferingSpeedThreshold(settings['proxy_settings'])
                  ? 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-200'
                  : 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200'
              }
            >
              {parseFloat(channel.ffmpeg_speed).toFixed(2)}x
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="py-2">
        <div className="flex justify-between w-full text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2 text-xs">
            <Gauge pr={5} size="22" /> {formatSpeed(bitrates.at(-1) || 0)}
          </div>

          <div className="flex">Avg: {avgBitrate}</div>

          <div className="flex">
            <HardDriveDownload size="18" />
            {formatBytes(totalBytes)}
          </div>

          <div className="flex">
            <Users size="18" />
            {clientCount}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default StreamConnectionCard;
