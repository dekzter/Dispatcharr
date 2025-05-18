import React, { useEffect, useMemo, useState, useCallback } from 'react';
import useChannelsStore from '../../store/channels';
import { notifications } from '@mantine/notifications';
import API from '../../api';
import ChannelForm from '../forms/Channel';
import RecordingForm from '../forms/Recording';
import { useDebounce, copyToClipboard } from '../../utils';
import logo from '../../images/logo.png';
import useVideoStore from '../../store/useVideoStore';
import useSettingsStore from '../../store/settings';
import {
  Tv2,
  ScreenShare,
  Scroll,
  SquareMinus,
  CirclePlay,
  SquarePen,
  Copy,
  ScanEye,
  EllipsisVertical,
  ArrowUpNarrowWide,
  ArrowUpDown,
  ArrowDownWideNarrow,
} from 'lucide-react';
import {
  Box,
  TextInput,
  Popover,
  ActionIcon,
  Button,
  Paper,
  Flex,
  Text,
  Group,
  useMantineTheme,
  Center,
  Switch,
  Menu,
  MultiSelect,
  Pagination,
  NativeSelect,
  UnstyledButton,
} from '@mantine/core';
import { getCoreRowModel, flexRender } from '@tanstack/react-table';
import './table.css';
import useChannelsTableStore from '../../store/channelsTable';
import ChannelTableStreams from './ChannelTableStreams';
import useLocalStorage from '../../hooks/useLocalStorage';
import { CustomTable, useTable } from './CustomTable';
import ChannelsTableOnboarding from './ChannelsTable/ChannelsTableOnboarding';
import ChannelTableHeader from './ChannelsTable/ChannelTableHeader';
import useWarningsStore from '../../store/warnings';
import ConfirmationDialog from '../ConfirmationDialog';
import useAuthStore from '../../store/auth';
import { USER_LEVELS } from '../../constants';

const m3uUrlBase = `${window.location.protocol}//${window.location.host}/output/m3u`;
const epgUrlBase = `${window.location.protocol}//${window.location.host}/output/epg`;
const hdhrUrlBase = `${window.location.protocol}//${window.location.host}/hdhr`;

const ChannelEnabledSwitch = React.memo(
  ({ rowId, selectedProfileId, selectedTableIds }) => {
    // Directly extract the channels set once to avoid re-renders on every change.
    const isEnabled = useChannelsStore(
      useCallback(
        (state) =>
          selectedProfileId === '0' ||
          state.profiles[selectedProfileId]?.channels.has(rowId),
        [rowId, selectedProfileId]
      )
    );

    const handleToggle = () => {
      if (selectedTableIds.length > 1) {
        API.updateProfileChannels(
          selectedTableIds,
          selectedProfileId,
          !isEnabled
        );
      } else {
        API.updateProfileChannel(rowId, selectedProfileId, !isEnabled);
      }
    };

    return (
      <Center style={{ width: '100%' }}>
        <Switch
          size="xs"
          checked={isEnabled}
          onChange={handleToggle}
          disabled={selectedProfileId === '0'}
        />
      </Center>
    );
  }
);

const ChannelRowActions = React.memo(
  ({
    theme,
    row,
    editChannel,
    deleteChannel,
    handleWatchStream,
    createRecording,
    getChannelURL,
  }) => {
    // Extract the channel ID once to ensure consistency
    const channelId = row.original.id;
    const channelUuid = row.original.uuid;
    const [tableSize, _] = useLocalStorage('table-size', 'default');

    const authUser = useAuthStore((s) => s.user);

    const onEdit = useCallback(() => {
      // Use the ID directly to avoid issues with filtered tables
      console.log(`Editing channel ID: ${channelId}`);
      editChannel(row.original);
    }, [channelId, row.original]);

    const onDelete = useCallback(() => {
      console.log(`Deleting channel ID: ${channelId}`);
      deleteChannel(channelId);
    }, [channelId]);

    const onPreview = useCallback(() => {
      // Use direct channel UUID for preview to avoid issues
      console.log(`Previewing channel UUID: ${channelUuid}`);
      handleWatchStream(row.original);
    }, [channelUuid]);

    const onRecord = useCallback(() => {
      console.log(`Recording channel ID: ${channelId}`);
      createRecording(row.original);
    }, [channelId]);

    const iconSize =
      tableSize == 'default' ? 'sm' : tableSize == 'compact' ? 'xs' : 'md';

    return (
      <Box style={{ width: '100%', justifyContent: 'left' }}>
        <Center>
          <ActionIcon
            size={iconSize}
            variant="transparent"
            color={theme.tailwind.yellow[3]}
            onClick={onEdit}
            disabled={authUser.user_level != USER_LEVELS.ADMIN}
          >
            <SquarePen size="18" />
          </ActionIcon>

          <ActionIcon
            size={iconSize}
            variant="transparent"
            color={theme.tailwind.red[6]}
            onClick={onDelete}
            disabled={authUser.user_level != USER_LEVELS.ADMIN}
          >
            <SquareMinus size="18" />
          </ActionIcon>

          <ActionIcon
            size={iconSize}
            variant="transparent"
            color={theme.tailwind.green[5]}
            onClick={onPreview}
          >
            <CirclePlay size="18" />
          </ActionIcon>

          <Menu>
            <Menu.Target>
              <ActionIcon variant="transparent" size={iconSize}>
                <EllipsisVertical size="18" />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<Copy size="14" />}>
                <UnstyledButton
                  size="xs"
                  onClick={() => copyToClipboard(getChannelURL(row.original))}
                >
                  <Text size="xs">Copy URL</Text>
                </UnstyledButton>
              </Menu.Item>
              <Menu.Item
                onClick={onRecord}
                disabled={authUser.user_level != USER_LEVELS.ADMIN}
                leftSection={
                  <div
                    style={{
                      borderRadius: '50%',
                      width: '10px',
                      height: '10px',
                      display: 'flex',
                      backgroundColor: 'red',
                    }}
                  ></div>
                }
              >
                <Text size="xs">Record</Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Center>
      </Box>
    );
  }
);

const ChannelsTable = ({}) => {
  const theme = useMantineTheme();

  /**
   * STORES
   */

  // store/channelsTable
  const data = useChannelsTableStore((s) => s.channels);
  const pageCount = useChannelsTableStore((s) => s.pageCount);
  const setSelectedChannelIds = useChannelsTableStore(
    (s) => s.setSelectedChannelIds
  );
  const selectedChannelIds = useChannelsTableStore((s) => s.selectedChannelIds);
  const pagination = useChannelsTableStore((s) => s.pagination);
  const setPagination = useChannelsTableStore((s) => s.setPagination);
  const sorting = useChannelsTableStore((s) => s.sorting);
  const setSorting = useChannelsTableStore((s) => s.setSorting);
  const totalCount = useChannelsTableStore((s) => s.totalCount);
  const setChannelStreams = useChannelsTableStore((s) => s.setChannelStreams);
  const allRowIds = useChannelsTableStore((s) => s.allQueryIds);
  const setAllRowIds = useChannelsTableStore((s) => s.setAllQueryIds);

  // store/channels
  const channels = useChannelsStore((s) => s.channels);
  const profiles = useChannelsStore((s) => s.profiles);
  const selectedProfileId = useChannelsStore((s) => s.selectedProfileId);
  const channelGroups = useChannelsStore((s) => s.channelGroups);
  const logos = useChannelsStore((s) => s.logos);
  const [tablePrefs, setTablePrefs] = useLocalStorage('channel-table-prefs', {
    pageSize: 50,
  });
  const selectedProfileChannels = useChannelsStore(
    (s) => s.profiles[selectedProfileId]?.channels
  );

  // store/settings
  const env_mode = useSettingsStore((s) => s.environment.env_mode);
  const showVideo = useVideoStore((s) => s.showVideo);
  const [tableSize, _] = useLocalStorage('table-size', 'default');

  // store/warnings
  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);

  /**
   * useMemo
   */
  const selectedProfileChannelIds = useMemo(
    () => new Set(selectedProfileChannels),
    [selectedProfileChannels]
  );

  /**
   * useState
   */
  const [channel, setChannel] = useState(null);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(
    profiles[selectedProfileId]
  );

  const [paginationString, setPaginationString] = useState('');
  const [filters, setFilters] = useState({
    name: '',
    channel_group: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  const [hdhrUrl, setHDHRUrl] = useState(hdhrUrlBase);
  const [epgUrl, setEPGUrl] = useState(epgUrlBase);
  const [m3uUrl, setM3UUrl] = useState(m3uUrlBase);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState(null);

  /**
   * Dereived variables
   */
  const activeGroupIds = new Set(
    Object.values(channels).map((channel) => channel.channel_group_id)
  );
  const groupOptions = Object.values(channelGroups)
    .filter((group) => activeGroupIds.has(group.id))
    .map((group) => group.name);
  const debouncedFilters = useDebounce(filters, 500);

  /**
   * Functions
   */
  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    params.append('page', pagination.pageIndex + 1);
    params.append('page_size', pagination.pageSize);
    params.append('include_streams', 'true');

    // Apply sorting
    if (sorting.length > 0) {
      const sortField = sorting[0].id;
      const sortDirection = sorting[0].desc ? '-' : '';
      params.append('ordering', `${sortDirection}${sortField}`);
    }

    // Apply debounced filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const [results, ids] = await Promise.all([
      await API.queryChannels(params),
      await API.getAllChannelIds(params),
    ]);

    setTablePrefs({
      pageSize: pagination.pageSize,
    });
    setAllRowIds(ids);
  }, [pagination, sorting, debouncedFilters]);

  const stopPropagation = useCallback((e) => {
    e.stopPropagation();
  }, []);

  // Remove useCallback to ensure we're using the latest setPagination function
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    // First reset pagination to page 0
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
    // Then update filters
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGroupChange = (value) => {
    // First reset pagination to page 0
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
    // Then update filters
    setFilters((prev) => ({
      ...prev,
      channel_group: value ? value : '',
    }));
  };

  const editChannel = async (ch = null) => {
    setChannel(ch);
    setChannelModalOpen(true);
  };

  const deleteChannel = async (id) => {
    console.log(`Deleting channel with ID: ${id}`);
    table.setSelectedTableIds([]);

    if (selectedChannelIds.length > 0) {
      // Use bulk delete for multiple selections
      setIsBulkDelete(true);
      setChannelToDelete(null);

      if (isWarningSuppressed('delete-channels')) {
        // Skip warning if suppressed
        return executeDeleteChannels();
      }

      setConfirmDeleteOpen(true);
      return;
    }

    // Single channel delete
    setIsBulkDelete(false);
    setDeleteTarget(id);
    setChannelToDelete(channels[id]); // Store the channel object for displaying details

    if (isWarningSuppressed('delete-channel')) {
      // Skip warning if suppressed
      return executeDeleteChannel(id);
    }

    setConfirmDeleteOpen(true);
  };

  const executeDeleteChannel = async (id) => {
    await API.deleteChannel(id);
    API.requeryChannels();
    setConfirmDeleteOpen(false);
  };

  const deleteChannels = async () => {
    if (isWarningSuppressed('delete-channels')) {
      // Skip warning if suppressed
      return executeDeleteChannels();
    }

    setIsBulkDelete(true);
    setConfirmDeleteOpen(true);
  };

  const executeDeleteChannels = async () => {
    setIsLoading(true);
    await API.deleteChannels(table.selectedTableIds);
    await API.requeryChannels();
    setSelectedChannelIds([]);
    table.setSelectedTableIds([]);
    setIsLoading(false);
    setConfirmDeleteOpen(false);
  };

  const createRecording = (channel) => {
    console.log(`Recording channel ID: ${channel.id}`);
    setChannel(channel);
    setRecordingModalOpen(true);
  };

  const getChannelURL = (channel) => {
    // Make sure we're using the channel UUID consistently
    if (!channel || !channel.uuid) {
      console.error('Invalid channel object or missing UUID:', channel);
      return '';
    }

    const uri = `/proxy/ts/stream/${channel.uuid}`;
    let channelUrl = `${window.location.protocol}//${window.location.host}${uri}`;
    if (env_mode == 'dev') {
      channelUrl = `${window.location.protocol}//${window.location.hostname}:5656${uri}`;
    }

    return channelUrl;
  };

  const handleWatchStream = (channel) => {
    // Add additional logging to help debug issues
    console.log(
      `Watching stream for channel: ${channel.name} (${channel.id}), UUID: ${channel.uuid}`
    );
    const url = getChannelURL(channel);
    console.log(`Stream URL: ${url}`);
    showVideo(url);
  };

  const onRowSelectionChange = (newSelection) => {
    setSelectedChannelIds(newSelection);
  };

  const onPageSizeChange = (e) => {
    setPagination({
      ...pagination,
      pageSize: e.target.value,
    });
  };

  const onPageIndexChange = (pageIndex) => {
    if (!pageIndex || pageIndex > pageCount) {
      return;
    }

    setPagination({
      ...pagination,
      pageIndex: pageIndex - 1,
    });
  };

  const closeChannelForm = () => {
    setChannel(null);
    setChannelModalOpen(false);
  };

  const closeRecordingForm = () => {
    // setChannel(null);
    setRecordingModalOpen(false);
  };

  const handleCopy = async (textToCopy, ref) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      notifications.show({
        title: 'Copied!',
        // style: { width: '200px', left: '200px' },
      });
    } catch (err) {
      const inputElement = ref.current; // Get the actual input

      if (inputElement) {
        inputElement.focus();
        inputElement.select();

        // For older browsers
        document.execCommand('copy');
        notifications.show({ title: 'Copied!' });
      }
    }
  };

  // Example copy URLs
  const copyM3UUrl = () => {
    copyToClipboard(m3uUrl);
  };
  const copyEPGUrl = () => {
    copyToClipboard(epgUrl);
  };
  const copyHDHRUrl = () => {
    copyToClipboard(hdhrUrl);
  };

  const onSortingChange = (column) => {
    const sortField = sorting[0]?.id;
    const sortDirection = sorting[0]?.desc;

    if (sortField == column) {
      if (sortDirection == false) {
        setSorting([
          {
            id: column,
            desc: true,
          },
        ]);
      } else {
        setSorting([]);
      }
    } else {
      setSorting([
        {
          id: column,
          desc: false,
        },
      ]);
    }
  };

  /**
   * useEffect
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedProfile(profiles[selectedProfileId]);

    const profileString =
      selectedProfileId != '0' ? `/${profiles[selectedProfileId].name}` : '';
    setHDHRUrl(`${hdhrUrlBase}${profileString}`);
    setEPGUrl(`${epgUrlBase}${profileString}`);
    setM3UUrl(`${m3uUrlBase}${profileString}`);
  }, [selectedProfileId]);

  useEffect(() => {
    const startItem = pagination.pageIndex * pagination.pageSize + 1; // +1 to start from 1, not 0
    const endItem = Math.min(
      (pagination.pageIndex + 1) * pagination.pageSize,
      totalCount
    );
    setPaginationString(`${startItem} to ${endItem} of ${totalCount}`);
  }, [data]);

  const columns = useMemo(
    () => [
      {
        id: 'expand',
        size: 20,
      },
      {
        id: 'select',
        size: 30,
      },
      {
        id: 'enabled',
        size: 45,
        cell: ({ row, table }) => {
          return (
            <ChannelEnabledSwitch
              rowId={row.original.id}
              selectedProfileId={selectedProfileId}
              selectedTableIds={table.getState().selectedTableIds}
            />
          );
        },
      },
      {
        id: 'channel_number',
        accessorKey: 'channel_number',
        size: 40,
        cell: ({ getValue }) => {
          const value = getValue();
          // Format as integer if no decimal component
          const formattedValue =
            value !== null && value !== undefined
              ? value === Math.floor(value)
                ? Math.floor(value)
                : value
              : '';

          return (
            <Flex justify="flex-end" style={{ width: '100%' }}>
              {formattedValue}
            </Flex>
          );
        },
      },
      {
        id: 'name',
        accessorKey: 'name',
        cell: ({ getValue }) => (
          <Box
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {getValue()}
          </Box>
        ),
      },
      {
        id: 'channel_group',
        accessorFn: (row) =>
          channelGroups[row.channel_group_id]
            ? channelGroups[row.channel_group_id].name
            : '',
        cell: ({ getValue }) => (
          <Box
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {getValue()}
          </Box>
        ),
      },
      {
        id: 'logo',
        accessorFn: (row) => {
          // Just pass the logo_id directly, not the full logo object
          return row.logo_id;
        },
        size: 75,
        header: '',
        cell: ({ getValue }) => {
          const logoId = getValue();
          let src = logo; // Default fallback

          if (logoId && logos[logoId]) {
            // Try to use cache_url if available, otherwise construct it from the ID
            src =
              logos[logoId].cache_url || `/api/channels/logos/${logoId}/cache/`;
          }

          return (
            <Center style={{ width: '100%' }}>
              <img
                src={src}
                alt="logo"
                style={{ maxHeight: 18, maxWidth: 55 }}
              />
            </Center>
          );
        },
      },
      {
        id: 'actions',
        size: tableSize == 'compact' ? 75 : 100,
        header: '',
        cell: ({ row }) => (
          <ChannelRowActions
            theme={theme}
            row={row}
            editChannel={editChannel}
            deleteChannel={deleteChannel}
            handleWatchStream={handleWatchStream}
            createRecording={createRecording}
            getChannelURL={getChannelURL}
          />
        ),
      },
    ],
    [selectedProfileId, channelGroups, logos, theme]
  );

  const renderHeaderCell = (header) => {
    let sortingIcon = ArrowUpDown;
    if (sorting[0]?.id == header.id) {
      if (sorting[0].desc === false) {
        sortingIcon = ArrowUpNarrowWide;
      } else {
        sortingIcon = ArrowDownWideNarrow;
      }
    }

    switch (header.id) {
      case 'enabled':
        return (
          <Center style={{ width: '100%' }}>
            <ScanEye size="16" />
          </Center>
        );

      case 'channel_number':
        return (
          <Flex gap={2}>
            #
            <Center>
              {React.createElement(sortingIcon, {
                onClick: () => onSortingChange('channel_number'),
                size: 14,
              })}
            </Center>
          </Flex>
        );

      case 'name':
        return (
          <Flex gap="sm">
            <TextInput
              name="name"
              placeholder="Name"
              value={filters.name || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={handleFilterChange}
              size="xs"
              variant="unstyled"
              className="table-input-header"
            />
            <Center>
              {React.createElement(sortingIcon, {
                onClick: () => onSortingChange('name'),
                size: 14,
              })}
            </Center>
          </Flex>
        );

      case 'channel_group':
        return (
          <MultiSelect
            placeholder="Group"
            variant="unstyled"
            data={groupOptions}
            size="xs"
            searchable
            clearable
            onClick={stopPropagation}
            onChange={handleGroupChange}
            style={{ width: '100%' }}
          />
        );
    }
  };

  const table = useTable({
    data,
    columns,
    allRowIds,
    pageCount,
    filters,
    pagination,
    sorting,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    onRowSelectionChange: onRowSelectionChange,
    getExpandedRowHeight: (row) => {
      return 20 + 28 * row.original.streams.length;
    },
    expandedRowRenderer: ({ row }) => {
      return (
        <Box
          key={row.id}
          className="tr"
          style={{ display: 'flex', width: '100%' }}
        >
          <ChannelTableStreams channel={row.original} isExpanded={true} />
        </Box>
      );
    },
    headerCellRenderFns: {
      name: renderHeaderCell,
      channel_number: renderHeaderCell,
      channel_group: renderHeaderCell,
      enabled: renderHeaderCell,
    },
    getRowStyles: (row) => {
      const hasStreams =
        row.original.streams && row.original.streams.length > 0;
      return hasStreams
        ? {} // Default style for channels with streams
        : {
            className: 'no-streams-row', // Add a class instead of background color
          };
    },
  });

  const rows = table.getRowModel().rows;

  return (
    <>
      <Box>
        {/* Header Row: outside the Paper */}
        <Flex style={{ alignItems: 'center', paddingBottom: 10 }} gap={15}>
          <Text
            w={88}
            h={24}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '20px',
              lineHeight: 1,
              letterSpacing: '-0.3px',
              color: 'gray.6', // Adjust this to match MUI's theme.palette.text.secondary
              marginBottom: 0,
            }}
          >
            Channels
          </Text>
          <Flex
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: 10,
            }}
          >
            <Text
              w={37}
              h={17}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: 1,
                letterSpacing: '-0.3px',
                color: 'gray.6', // Adjust this to match MUI's theme.palette.text.secondary
              }}
            >
              Links:
            </Text>

            <Group gap={5} style={{ paddingLeft: 10 }}>
              <Popover withArrow shadow="md">
                <Popover.Target>
                  <Button
                    leftSection={<Tv2 size={18} />}
                    size="compact-sm"
                    p={5}
                    color="green"
                    variant="subtle"
                    style={{
                      borderColor: theme.palette.custom.greenMain,
                      color: theme.palette.custom.greenMain,
                    }}
                  >
                    HDHR
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Group>
                    <TextInput value={hdhrUrl} size="small" readOnly />
                    <ActionIcon
                      onClick={copyHDHRUrl}
                      size="sm"
                      variant="transparent"
                      color="gray.5"
                    >
                      <Copy size="18" fontSize="small" />
                    </ActionIcon>
                  </Group>
                </Popover.Dropdown>
              </Popover>

              <Popover withArrow shadow="md">
                <Popover.Target>
                  <Button
                    leftSection={<ScreenShare size={18} />}
                    size="compact-sm"
                    p={5}
                    variant="subtle"
                    style={{
                      borderColor: theme.palette.custom.indigoMain,
                      color: theme.palette.custom.indigoMain,
                    }}
                  >
                    M3U
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Group>
                    <TextInput value={m3uUrl} size="small" readOnly />
                    <ActionIcon
                      onClick={copyM3UUrl}
                      size="sm"
                      variant="transparent"
                      color="gray.5"
                    >
                      <Copy size="18" fontSize="small" />
                    </ActionIcon>
                  </Group>
                </Popover.Dropdown>
              </Popover>

              <Popover withArrow shadow="md">
                <Popover.Target>
                  <Button
                    leftSection={<Scroll size={18} />}
                    size="compact-sm"
                    p={5}
                    variant="subtle"
                    color="gray.5"
                    style={{
                      borderColor: theme.palette.custom.greyBorder,
                      color: theme.palette.custom.greyBorder,
                    }}
                  >
                    EPG
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  <Group>
                    <TextInput value={epgUrl} size="small" readOnly />
                    <ActionIcon
                      onClick={copyEPGUrl}
                      size="sm"
                      variant="transparent"
                      color="gray.5"
                    >
                      <Copy size="18" fontSize="small" />
                    </ActionIcon>
                  </Group>
                </Popover.Dropdown>
              </Popover>
            </Group>
          </Flex>
        </Flex>

        {/* Paper container: contains top toolbar and table (or ghost state) */}
        <Paper
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 58px)',
            backgroundColor: '#27272A',
          }}
        >
          <ChannelTableHeader
            rows={rows}
            editChannel={editChannel}
            deleteChannels={deleteChannels}
            selectedTableIds={table.selectedTableIds}
          />

          {/* Table or ghost empty state inside Paper */}
          <Box>
            {Object.keys(channels).length === 0 && (
              <ChannelsTableOnboarding editChannel={editChannel} />
            )}
          </Box>

          {Object.keys(channels).length > 0 && (
            <Box
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 110px)',
              }}
            >
              <Box
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  border: 'solid 1px rgb(68,68,68)',
                  borderRadius: 'var(--mantine-radius-default)',
                }}
              >
                <CustomTable table={table} />
              </Box>

              <Box
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 3,
                  backgroundColor: '#27272A',
                }}
              >
                <Group
                  gap={5}
                  justify="center"
                  style={{
                    padding: 8,
                    borderTop: '1px solid #666',
                  }}
                >
                  <Text size="xs">Page Size</Text>
                  <NativeSelect
                    size="xxs"
                    value={pagination.pageSize}
                    data={['25', '50', '100', '250']}
                    onChange={onPageSizeChange}
                    style={{ paddingRight: 20 }}
                  />
                  <Pagination
                    total={pageCount}
                    value={pagination.pageIndex + 1}
                    onChange={onPageIndexChange}
                    size="xs"
                    withEdges
                    style={{ paddingRight: 20 }}
                  />
                  <Text size="xs">{paginationString}</Text>
                </Group>
              </Box>
            </Box>
          )}
        </Paper>

        <ChannelForm
          channel={channel}
          isOpen={channelModalOpen}
          onClose={closeChannelForm}
        />

        <RecordingForm
          channel={channel}
          isOpen={recordingModalOpen}
          onClose={closeRecordingForm}
        />
      </Box>

      <ConfirmationDialog
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() =>
          isBulkDelete
            ? executeDeleteChannels()
            : executeDeleteChannel(deleteTarget)
        }
        title={`Confirm ${isBulkDelete ? 'Bulk ' : ''}Channel Deletion`}
        message={
          isBulkDelete ? (
            `Are you sure you want to delete ${table.selectedTableIds.length} channels? This action cannot be undone.`
          ) : channelToDelete ? (
            <div style={{ whiteSpace: 'pre-line' }}>
              {`Are you sure you want to delete the following channel?

Name: ${channelToDelete.name}
Channel Number: ${channelToDelete.channel_number}

This action cannot be undone.`}
            </div>
          ) : (
            'Are you sure you want to delete this channel? This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        actionKey={isBulkDelete ? 'delete-channels' : 'delete-channel'}
        onSuppressChange={suppressWarning}
        size="md"
      />
    </>
  );
};

export default ChannelsTable;
