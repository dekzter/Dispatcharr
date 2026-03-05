import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import type { Route } from './+types/channels';
import { Allotment } from 'allotment';
import ChannelsTable from './channels/ChannelsTable';
import storage from '@/lib/safe-storage';
import useChannelsStore from '@/store/channels';
import useStreamProfilesStore from '@/store/streamProfiles';
import API from '@/lib/api';
import {
  fetchActiveChannelStats,
  getClientStats,
  getCombinedConnections,
  getCurrentPrograms,
  getStatsByChannelId,
  getVODStats,
  stopChannel,
  stopClient,
  stopVODClient,
} from '@/lib/stats.js';
import { Card } from '@/components/ui/card';
import StreamConnectionCard from './stats/StreamConnectionCard';
import useLogosStore from '@/store/logos';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Connections - Dispatcharr' },
    { name: 'description', content: 'View active connections' },
  ];
}

export default function Stats({ loaderData }: Route.ComponentProps) {
  const channelStats = useChannelsStore((s) => s.stats);
  const setChannelStats = useChannelsStore((s) => s.setChannelStats);
  const streamProfiles = useStreamProfilesStore((s) => s.profiles);
  const logos = useLogosStore((s) => s.logos);

  const [clients, setClients] = useState([]);
  const [vodConnections, setVodConnections] = useState([]);
  const [channelHistory, setChannelHistory] = useState({});
  const [isPollingActive, setIsPollingActive] = useState(false);
  const [currentPrograms, setCurrentPrograms] = useState({});
  const [channels, setChannels] = useState({}); // id -> channel
  const [channelsByUUID, setChannelsByUUID] = useState({}); // uuid -> id

  // Use refs to hold latest values without triggering effects
  const channelHistoryRef = useRef(channelHistory);
  const channelsByUUIDRef = useRef(channelsByUUID);

  // Update refs when values change
  useEffect(() => {
    channelHistoryRef.current = channelHistory;
  }, [channelHistory]);

  useEffect(() => {
    channelsByUUIDRef.current = channelsByUUID;
  }, [channelsByUUID]);

  // Compute needed channel UUIDs from the current active channels
  const neededUUIDs = useMemo(
    () => Object.keys(channelHistory || {}),
    [channelHistory]
  );

  // Fetch any missing channels by UUID when the needed set changes
  useEffect(() => {
    if (!neededUUIDs || neededUUIDs.length === 0) return;
    const missing = neededUUIDs.filter((u) => channelsByUUID[u] === undefined);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await API.getChannelsByUUIDs(missing);
        if (cancelled) return;
        if (Array.isArray(res)) {
          setChannels((prev) => {
            const next = { ...prev };
            for (const ch of res) next[ch.id] = ch;
            return next;
          });
          setChannelsByUUID((prev) => {
            const next = { ...prev };
            for (const ch of res) next[ch.uuid] = ch.id;
            return next;
          });
        }
      } catch (e) {
        console.error('Failed to fetch channels by UUIDs', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [neededUUIDs.join(','), channelsByUUID]);

  // Use localStorage for stats refresh interval (in seconds)
  // const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useLocalStorage(
  //   'stats-refresh-interval',
  //   5
  // );
  // @TODO-v2: local storage
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(5);
  const refreshInterval = refreshIntervalSeconds * 1000; // Convert to milliseconds
  const channelHistoryLength = Object.keys(channelHistory).length;
  const vodConnectionsCount = vodConnections.reduce(
    (total, vodContent) => total + (vodContent.connections?.length || 0),
    0
  );

  const handleStopVODClient = async (clientId) => {
    await stopVODClient(clientId);
    // Refresh VOD stats after stopping to update the UI
    fetchVODStats();
  };

  // Function to fetch channel stats from API
  const fetchChannelStats = useCallback(async () => {
    try {
      const response = await fetchActiveChannelStats();
      if (response) {
        setChannelStats(response);
      } else {
        console.log('API response was empty or null');
      }
    } catch (error) {
      console.error('Error fetching channel stats:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        body: error.body,
      });
    }
  }, [setChannelStats]);

  const fetchVODStats = useCallback(async () => {
    try {
      const response = await getVODStats();
      if (response) {
        setVodConnections(response.vod_connections || []);
      } else {
        console.log('VOD API response was empty or null');
      }
    } catch (error) {
      console.error('Error fetching VOD stats:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        body: error.body,
      });
    }
  }, []);

  // Set up polling for stats when on stats page
  useEffect(() => {
    const location = window.location;
    const isOnStatsPage = location.pathname === '/stats';

    if (isOnStatsPage && refreshInterval > 0) {
      setIsPollingActive(true);

      // Initial fetch
      fetchChannelStats();
      fetchVODStats();

      // Set up interval
      const interval = setInterval(() => {
        fetchChannelStats();
        fetchVODStats();
      }, refreshInterval);

      return () => {
        clearInterval(interval);
        setIsPollingActive(false);
      };
    } else {
      setIsPollingActive(false);
    }
  }, [refreshInterval, fetchChannelStats, fetchVODStats]);

  // Fetch initial stats on component mount (for immediate data when navigating to page)
  useEffect(() => {
    fetchChannelStats();
    fetchVODStats();
  }, [fetchChannelStats, fetchVODStats]);

  useEffect(() => {
    console.log('Processing channel stats:', channelStats);
    if (
      !channelStats ||
      !channelStats.channels ||
      !Array.isArray(channelStats.channels) ||
      channelStats.channels.length === 0
    ) {
      console.log('No channel stats available:', channelStats);
      // Clear clients and channel history when there are no stats
      setClients([]);
      setChannelHistory({});
      return;
    }

    // Use functional update to access previous state without dependency
    setChannelHistory((prevChannelHistory) => {
      // Create a completely new object based only on current channel stats
      const stats = getStatsByChannelId(
        channelStats,
        prevChannelHistory,
        channelsByUUID,
        channels,
        streamProfiles
      );

      console.log('Processed active channels:', stats);

      // Update clients based on new stats
      setClients(getClientStats(stats));

      return stats; // Return only currently active channels
    });
  }, [channelStats, channels, channelsByUUID, streamProfiles]);

  // Track which channel IDs are active (only changes when channels start/stop, not on stats updates)
  const activeChannelIds = useMemo(() => {
    return Object.keys(channelHistory).sort().join(',');
  }, [channelHistory]);

  // Smart polling for current programs - only fetch when active channels change
  useEffect(() => {
    // Skip if no active channels
    if (!activeChannelIds) {
      setCurrentPrograms({});
      return;
    }

    let timer = null;

    const fetchPrograms = async () => {
      // Use refs to get latest values without adding dependencies
      const programs = await getCurrentPrograms(
        channelHistoryRef.current,
        channelsByUUIDRef.current
      );
      setCurrentPrograms(programs);

      // Schedule next fetch based on nearest program end time
      if (programs && Object.keys(programs).length > 0) {
        const now = new Date();
        let nearestEndTime = null;

        Object.values(programs).forEach((program) => {
          if (program && program.end_time) {
            const endTime = new Date(program.end_time);
            if (
              endTime > now &&
              (!nearestEndTime || endTime < nearestEndTime)
            ) {
              nearestEndTime = endTime;
            }
          }
        });

        if (nearestEndTime) {
          const timeUntilChange = nearestEndTime.getTime() - now.getTime();
          const fetchDelay = Math.max(timeUntilChange + 5000, 0);

          timer = setTimeout(fetchPrograms, fetchDelay);
        }
      }
    };

    // Initial fetch
    fetchPrograms();

    // Cleanup timer on unmount or when active channels change
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeChannelIds]); // Only depend on activeChannelIds

  // Combine active streams and VOD connections into a single mixed list
  const combinedConnections = useMemo(() => {
    return getCombinedConnections(channelHistory, vodConnections);
  }, [channelHistory, vodConnections]);

  return (
    <div className="flex flex-col p-2">
      <div className="border-b w-full">
        <h1 className="text-2xl tracking-tight">Active Streams</h1>
      </div>

      <div className="grid gap-4 py-2 sm:grid-cols-2 xl:grid-cols-3 px-2">
        {combinedConnections.map((connection) => {
          if (connection.type === 'stream') {
            return (
              <StreamConnectionCard
                key={connection.id}
                channel={connection.data}
                clients={clients}
                stopClient={stopClient}
                stopChannel={stopChannel}
                logos={logos}
                channelsByUUID={channelsByUUID}
                channels={channels}
                currentProgram={currentPrograms[connection.data.channel_id]}
              />
            );
          } else if (connection.type === 'vod') {
            return (
              <></>
              // <VodConnectionCard
              //   key={connection.id}
              //   vodContent={connection.data}
              //   stopVODClient={handleStopVODClient}
              // />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
