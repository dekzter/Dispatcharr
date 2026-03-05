import ConfirmationDialog from '@/components/ConfirmationDialog';
import { SearchableInput } from '@/components/dispatcharr/searchable-input';
import { SmartPagination } from '@/components/SmartPagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import useLocalStorage from '@/hooks/use-local-storage';
import API from '@/lib/api';
import { copyToClipboard, useDebounce } from '@/lib/utils';
import useChannelsStore from '@/store/channels';
import useChannelsTableStore from '@/store/channelsTable';
import usePlaylistsStore from '@/store/playlists';
import useSettingsStore from '@/store/settings';
import useStreamsTableStore from '@/store/streamsTable';
import useVideoStore from '@/store/useVideoStore';
import useWarningsStore from '@/store/warnings';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  EllipsisVertical,
  Eye,
  EyeOff,
  Filter,
  ListPlus,
  Plus,
  RotateCcw,
  Square,
  SquareCheck,
  SquareMinus,
  SquarePlus,
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import CreateChannelFromStreamForm from './CreateChannelFromStreamForm';
import StreamForm from './StreamForm';

const StreamRowActions = ({
  row,
  editStream,
  deleteStream,
  handleWatchStream,
  selectedChannelIds,
  createChannelFromStream,
  table,
}) => {
  const tableSize = table?.tableSize ?? 'default';
  const channelSelectionStreams = useChannelsTableStore(
    (state) =>
      state.channels.find((chan) => chan.id === selectedChannelIds[0])?.streams
  );

  const addStreamToChannel = async () => {
    await API.updateChannel({
      id: selectedChannelIds[0],
      streams: [
        ...new Set(
          channelSelectionStreams.map((s) => s.id).concat([row.original.id])
        ),
      ],
    });
    await API.requeryChannels();
  };

  const onEdit = useCallback(() => {
    editStream(row.original);
  }, [row.original, editStream]);

  const onDelete = useCallback(() => {
    deleteStream(row.original.id);
  }, [row.original.id, deleteStream]);

  const onPreview = useCallback(() => {
    console.log(
      'Previewing stream:',
      row.original.name,
      'ID:',
      row.original.id,
      'Hash:',
      row.original.stream_hash
    );
    handleWatchStream(row.original.stream_hash);
  }, [row.original, handleWatchStream]); // Add proper dependencies to ensure correct stream

  const iconSize =
    tableSize == 'default' ? 'sm' : tableSize == 'compact' ? 'xs' : 'md';

  const existsInChannel =
    selectedChannelIds.length !== 1 ||
    (channelSelectionStreams &&
      channelSelectionStreams.map((s) => s.id).includes(row.original.id));

  return (
    <div className="flex justify-between content-center">
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={`h-4 w-4 p-0 cursor-pointer rounded-sm border-1 ${existsInChannel ? 'text-muted-foreground cursor-not-allowed' : 'text-[var(--info)] hover:text-[var(--info-foreground)]'}`}
            onClick={addStreamToChannel}
            disabled={existsInChannel}
          >
            <ListPlus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add to Channel</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-4 w-4 p-0 cursor-pointer text-[var(--success)]"
            onClick={() => createChannelFromStream(row.original)}
          >
            <SquarePlus size="18" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create New Channel</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            role="button"
            className="h-4 w-4 p-0 text-blue-500 h-4 w-4 p-0 cursor-pointer"
          >
            <EllipsisVertical size={18} />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => copyToClipboard(row.original.url)}
          >
            <Copy size={14} />
            Copy URL
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer" onClick={onDelete}>
            Delete
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer" onClick={onPreview}>
            Preview
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const StreamSelectHeader = React.memo(({ table }) => {
  const streamIds = useStreamsTableStore((s) => s.allQueryIds);
  const selectedStreamIds = useStreamsTableStore((s) => s.selectedStreamIds);
  const setSelectedStreamIds = useStreamsTableStore(
    (s) => s.setSelectedStreamIds
  );

  return (
    <div className="flex items-center h-full">
      <Checkbox
        className="!h-4"
        checked={
          (streamIds.length > 0 &&
            selectedStreamIds.length === streamIds.length) ||
          (selectedStreamIds.length > 0 && 'indeterminate')
        }
        onCheckedChange={(value) => {
          table.toggleAllPageRowsSelected(!!value);
          // setLastSelectedIndex(null);
          setSelectedStreamIds(value ? streamIds : []);
        }}
        aria-label="Select all"
      />
    </div>
  );
});

const NameColumnHeader = React.memo(({ column }) => {
  const [inputValue, setInputValue] = useState(
    (column.getFilterValue() as string) ?? ''
  );
  const debouncedValue = useDebounce(inputValue, 500);

  useEffect(() => {
    column.setFilterValue(debouncedValue || undefined);
  }, [debouncedValue, column]);

  // Sync input when filter is cleared externally
  useEffect(() => {
    const currentFilter = column.getFilterValue() as string;
    if (!currentFilter && inputValue) {
      setInputValue('');
    }
  }, [column.getFilterValue()]);

  return (
    <div className="flex space-y-2">
      <Input
        className="!mb-0"
        placeholder="Name"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-3 w-3" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-3 w-3" />
        ) : (
          <ArrowUpDown className="ml-2 h-3 w-3" />
        )}
      </Button>
    </div>
  );
});

const StreamsTable = ({ onReady }) => {
  const hasSignaledReady = useRef(false);
  const hasFetchedOnce = useRef(false);
  const hasFetchedPlaylists = useRef(false);
  const hasFetchedChannelGroups = useRef(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const groupSearchRef = useRef<any>(null);
  const m3uSearchRef = useRef<any>(null);

  /**
   * useState
   */
  const [stream, setStream] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [m3uOptions, setM3uOptions] = useState([]);
  const [initialDataCount, setInitialDataCount] = useState(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const [hideStale, setHideStale] = useState(false);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const [paginationString, setPaginationString] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fetchVersionRef = useRef(0); // Track fetch version to prevent stale updates
  const lastFetchParamsRef = useRef(null); // Track last fetch params to prevent duplicate requests
  const fetchInProgressRef = useRef(false); // Track if a fetch is currently in progress

  // Channel creation modal state (bulk)
  const [channelNumberingModalOpen, setChannelNumberingModalOpen] =
    useState(false);
  const [numberingMode, setNumberingMode] = useState('provider'); // 'provider', 'auto', or 'custom'
  const [customStartNumber, setCustomStartNumber] = useState(1);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [bulkSelectedProfileIds, setBulkSelectedProfileIds] = useState([]);

  // Channel creation modal state (single)
  const [singleChannelModalOpen, setSingleChannelModalOpen] = useState(false);
  const [singleChannelMode, setSingleChannelMode] = useState('provider'); // 'provider', 'auto', or 'specific'
  const [specificChannelNumber, setSpecificChannelNumber] = useState(1);
  const [rememberSingleChoice, setRememberSingleChoice] = useState(false);
  const [currentStreamForChannel, setCurrentStreamForChannel] = useState(null);
  const [singleSelectedProfileIds, setSingleSelectedProfileIds] = useState([]);

  // Confirmation dialog state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [streamToDelete, setStreamToDelete] = useState(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // const [allRowsSelected, setAllRowsSelected] = useState(false);

  // Add local storage for page size
  const [storedPageSize, setStoredPageSize] = useLocalStorage(
    'streams-page-size',
    50
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [filters, setFilters] = useState({
    name: '',
    channel_group: '',
    m3u_account: '',
    unassigned: false,
    hide_stale: false,
  });
  const [columnSizing, setColumnSizing] = useState({});
  // const [columnSizing, setColumnSizing] = useLocalStorage(
  //   'streams-table-column-sizing',
  //   {}
  // );

  // Column visibility - persisted to localStorage
  // Default visible: name, group, m3u
  // Default hidden: tvg_id, stats
  const DEFAULT_COLUMN_VISIBILITY = {
    actions: true,
    select: true,
    name: true,
    group: true,
    m3u: true,
    tvg_id: false,
    stats: false,
  };

  const [storedColumnVisibility, setStoredColumnVisibility] = useLocalStorage(
    'streams-table-column-visibility',
    null // Use null as default to detect fresh install
  );

  // Merge defaults with stored values, ensuring all columns have values
  // - Fresh install (null): use defaults
  // - Existing users: merge settings with defaults for any new columns
  const columnVisibility = useMemo(() => {
    if (!storedColumnVisibility || typeof storedColumnVisibility !== 'object') {
      return DEFAULT_COLUMN_VISIBILITY;
    }
    // Merge: start with defaults, overlay stored values only for keys that exist in defaults
    const merged = { ...DEFAULT_COLUMN_VISIBILITY };
    for (const key of Object.keys(DEFAULT_COLUMN_VISIBILITY)) {
      if (
        key in storedColumnVisibility &&
        typeof storedColumnVisibility[key] === 'boolean'
      ) {
        merged[key] = storedColumnVisibility[key];
      }
    }
    return merged;
  }, [storedColumnVisibility]);

  const setColumnVisibility = (newValue) => {
    if (typeof newValue === 'function') {
      setStoredColumnVisibility((prev) => {
        const prevMerged =
          prev && typeof prev === 'object'
            ? { ...DEFAULT_COLUMN_VISIBILITY, ...prev }
            : DEFAULT_COLUMN_VISIBILITY;
        return newValue(prevMerged);
      });
    } else {
      setStoredColumnVisibility(newValue);
    }
  };

  const toggleColumnVisibility = (columnId) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const resetColumnVisibility = () => {
    setStoredColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
  };

  const debouncedFilters = useDebounce(columnFilters, 500, () => {
    // Reset to first page whenever filters change to avoid "Invalid page" errors
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
  });

  const navigate = useNavigate();

  /**
   * Stores
   */
  const playlists = usePlaylistsStore((s) => s.playlists);
  const fetchPlaylists = usePlaylistsStore((s) => s.fetchPlaylists);
  const playlistsLoading = usePlaylistsStore((s) => s.isLoading);

  // Get direct access to channel groups without depending on other data
  const fetchChannelGroups = useChannelsStore((s) => s.fetchChannelGroups);
  const channelGroups = useChannelsStore((s) => s.channelGroups);

  const selectedChannelIds = useChannelsTableStore((s) => s.selectedChannelIds);
  const channelSelectionStreams = useChannelsTableStore(
    (state) =>
      state.channels.find((chan) => chan.id === selectedChannelIds[0])?.streams
  );
  const channelProfiles = useChannelsStore((s) => s.profiles);
  const selectedProfileId = useChannelsStore((s) => s.selectedProfileId);
  const env_mode = useSettingsStore((s) => s.environment.env_mode);
  const showVideo = useVideoStore((s) => s.showVideo);
  const videoIsVisible = useVideoStore((s) => s.isVisible);

  const data = useStreamsTableStore((s) => s.streams);
  const pageCount = useStreamsTableStore((s) => s.pageCount);
  const totalCount = useStreamsTableStore((s) => s.totalCount);
  const allRowIds = useStreamsTableStore((s) => s.allQueryIds);
  const setAllRowIds = useStreamsTableStore((s) => s.setAllQueryIds);
  const pagination = useStreamsTableStore((s) => s.pagination);
  const setPagination = useStreamsTableStore((s) => s.setPagination);
  const sorting = useStreamsTableStore((s) => s.sorting);
  const setSorting = useStreamsTableStore((s) => s.setSorting);
  const selectedStreamIds = useStreamsTableStore((s) => s.selectedStreamIds);
  const setSelectedStreamIds = useStreamsTableStore(
    (s) => s.setSelectedStreamIds
  );

  // Warnings store for "remember choice" functionality
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);
  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);

  const handleSelectClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  /**
   * useMemo
   */
  const columns = useMemo(
    () => [
      {
        id: 'actions',
        size: 65,
        enableResizing: false,
        cell: ({ row }) => (
          <StreamRowActions
            row={row}
            editStream={editStream}
            deleteStream={deleteStream}
            handleWatchStream={handleWatchStream}
            selectedChannelIds={selectedChannelIds}
            createChannelFromStream={createChannelFromStream}
          />
        ),
      },
      {
        id: 'select',
        size: 30,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => <StreamSelectHeader table={table} />,
        cell: ({ row, table }) => (
          <Checkbox
            className="!h-4"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value);
            }}
            aria-label="Select row"
          />
        ),
      },
      {
        accessorKey: 'name',
        grow: true,
        size: columnSizing.name || 200,
        minSize: 100,
        header: ({ column }) => <NameColumnHeader column={column} />,
        cell: ({ getValue }) => (
          <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap h-full content-center">
            {getValue()}
          </div>
        ),
      },
      {
        id: 'channel_group',
        enableResizing: true,
        enableSorting: false,
        size: columnSizing.group || 150,
        minSize: 75,
        accessorFn: (row) =>
          channelGroups[row.channel_group]
            ? channelGroups[row.channel_group].name
            : '',
        header: ({ column }) => {
          return (
            <div className="space-y-2 flex">
              <div className="flex items-center justify-center gap-2 pr-3">
                <SearchableInput
                  placeholder="Groups"
                  options={Object.values(channelGroups).map((group) => ({
                    label: group.name,
                    value: group.id,
                  }))}
                  allowMultiple={true}
                  ref={groupSearchRef}
                  onSelect={(values) => {
                    column.setFilterValue(values.map((v) => v.label).join(','));
                  }}
                  autoFocus={false}
                  clearable={true}
                  className="h-6"
                />
              </div>
            </div>
          );
        },
        cell: ({ getValue }) => (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                {getValue()}
              </div>
            </TooltipTrigger>
            <TooltipContent>{getValue()}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        id: 'm3u',
        size: columnSizing.m3u || 150,
        minSize: 75,
        accessorFn: (row) =>
          playlists.find((playlist) => playlist.id === row.m3u_account)?.name,
        header: ({ column }) => {
          return (
            <div className="space-y-2 flex">
              <div className="flex items-center justify-center gap-2 pr-3">
                <SearchableInput
                  placeholder="M3U"
                  options={m3uOptions}
                  allowMultiple={true}
                  ref={m3uSearchRef}
                  onSelect={(values) => {
                    column.setFilterValue(values.map((v) => v.label).join(','));
                  }}
                  autoFocus={false}
                  clearable={true}
                  className="h-6"
                />
              </div>
            </div>
          );
        },
        cell: ({ getValue }) => (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                {getValue()}
              </div>
            </TooltipTrigger>
            <TooltipContent>{getValue()}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        header: 'TVG-ID',
        id: 'tvg_id',
        accessorKey: 'tvg_id',
        size: columnSizing.tvg_id || 120,
        minSize: 75,
        enableHiding: true,
        cell: ({ getValue }) => (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                {getValue()}
              </div>
            </TooltipTrigger>
            <TooltipContent>{getValue()}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        header: 'Stats',
        id: 'stats',
        accessorKey: 'stream_stats',
        size: columnSizing.stats || 120,
        minSize: 75,
        cell: ({ getValue }) => {
          const stats = getValue();
          if (!stats) return '-';

          // Build compact display (resolution + video codec)
          const parts = [];
          if (stats.resolution) {
            // Convert "1920x1080" to "1080p" format
            const height = stats.resolution.split('x')[1];
            if (height) parts.push(`${height}p`);
          }
          if (stats.video_codec) {
            parts.push(stats.video_codec.toUpperCase());
          }
          const compactDisplay = parts.length > 0 ? parts.join(' ') : '-';

          // Build tooltip content with friendly labels
          const tooltipLines = [];
          if (stats.resolution)
            tooltipLines.push(`Resolution: ${stats.resolution}`);
          if (stats.video_codec)
            tooltipLines.push(
              `Video Codec: ${stats.video_codec.toUpperCase()}`
            );
          if (stats.video_bitrate)
            tooltipLines.push(`Video Bitrate: ${stats.video_bitrate} kbps`);
          if (stats.source_fps)
            tooltipLines.push(`Frame Rate: ${stats.source_fps} FPS`);
          if (stats.audio_codec)
            tooltipLines.push(
              `Audio Codec: ${stats.audio_codec.toUpperCase()}`
            );
          if (stats.audio_channels)
            tooltipLines.push(`Audio Channels: ${stats.audio_channels}`);
          if (stats.audio_bitrate)
            tooltipLines.push(`Audio Bitrate: ${stats.audio_bitrate} kbps`);

          const tooltipContent =
            tooltipLines.length > 0
              ? tooltipLines.join('\n')
              : 'No source info available';

          return (
            <Tooltip delayDuration={500}>
              <TooltipTrigger asChild>
                <div className="whitespace-nowrap overflow-hidden text-ellipsis text-sm">
                  {compactDisplay}
                </div>
              </TooltipTrigger>
              <TooltipContent>{tooltipContent}</TooltipContent>
            </Tooltip>
          );
        },
      },
    ],
    [channelGroups, playlists, columnSizing, selectedChannelIds]
  );

  const toggleUnassignedOnly = () => {
    setShowUnassignedOnly(!showUnassignedOnly);
  };

  const toggleHideStale = () => {
    setHideStale(!hideStale);
  };

  const fetchData = useCallback(
    async ({ showLoader = true } = {}) => {
      const params = new URLSearchParams();
      params.append('page', pagination.pageIndex + 1);
      params.append('page_size', pagination.pageSize);

      // Apply sorting
      if (sorting.length > 0) {
        const columnId = sorting[0].id;
        // Map frontend column IDs to backend field names
        const fieldMapping = {
          name: 'name',
          group: 'channel_group__name',
          m3u: 'm3u_account__name',
          tvg_id: 'tvg_id',
        };
        const sortField = fieldMapping[columnId] || columnId;
        const sortDirection = sorting[0].desc ? '-' : '';
        params.append('ordering', `${sortDirection}${sortField}`);
      }

      // Apply debounced filters; send boolean filters as 'true' when set
      debouncedFilters.forEach(({ id, value }) => {
        if (typeof value === 'boolean') {
          if (value) params.append(id, 'true');
        } else if (value !== null && value !== undefined && value !== '') {
          params.append(id, String(value));
        }
      });

      const paramsString = params.toString();

      // Skip if same fetch is already in progress (prevents StrictMode double-fetch)
      if (
        fetchInProgressRef.current &&
        lastFetchParamsRef.current === paramsString
      ) {
        return;
      }

      // Increment fetch version to track this specific fetch request
      const currentFetchVersion = ++fetchVersionRef.current;
      lastFetchParamsRef.current = paramsString;
      fetchInProgressRef.current = true;

      if (showLoader) {
        setIsLoading(true);
      }

      try {
        const [result, ids, filterOptions] = await Promise.all([
          API.queryStreamsTable(params),
          API.getAllStreamIds(params),
          API.getStreamFilterOptions(params),
        ]);

        fetchInProgressRef.current = false;

        // Skip state updates if a newer fetch has been initiated
        if (currentFetchVersion !== fetchVersionRef.current) {
          return;
        }

        setAllRowIds(ids);

        // Set filtered options based on current filters
        // Ensure groupOptions is always an array of valid strings
        if (filterOptions && typeof filterOptions === 'object') {
          setGroupOptions(
            (filterOptions.groups || [])
              .filter((group) => group != null && group !== '')
              .map((group) => String(group))
          );
          // Ensure m3uOptions is always an array of valid objects
          setM3uOptions(
            (filterOptions.m3u_accounts || [])
              .filter((m3u) => m3u && m3u.id != null && m3u.name)
              .map((m3u) => ({
                label: String(m3u.name),
                value: String(m3u.id),
              }))
          );
        }

        if (initialDataCount === null) {
          setInitialDataCount(result.count);
        }

        // Signal that initial data load is complete
        if (!hasSignaledReady.current && onReady) {
          hasSignaledReady.current = true;
          onReady();
        }
      } catch (error) {
        fetchInProgressRef.current = false;

        // Skip logging if a newer fetch has been initiated
        if (currentFetchVersion !== fetchVersionRef.current) {
          return;
        }
        console.error('Error fetching data:', error);
      }

      // Skip state updates if a newer fetch has been initiated
      if (currentFetchVersion !== fetchVersionRef.current) {
        return;
      }

      hasFetchedOnce.current = true;
      if (showLoader) {
        setIsLoading(false);
      }
    },
    [
      pagination,
      sorting,
      debouncedFilters,
      onReady,
      showUnassignedOnly,
      hideStale,
    ]
  );

  // Bulk creation: create channels from selected streams asynchronously
  const createChannelsFromStreams = async () => {
    if (selectedStreamIds.length === 0) return;

    // Set default profile selection based on current profile filter
    const defaultProfileIds =
      selectedProfileId === '0' ? ['all'] : [selectedProfileId];
    setBulkSelectedProfileIds(defaultProfileIds);

    // Check if user has suppressed the channel numbering dialog
    const actionKey = 'channel-numbering-choice';
    if (isWarningSuppressed(actionKey)) {
      // Use the remembered settings or default to 'provider' mode
      const savedMode =
        localStorage.getItem('channel-numbering-mode') || 'provider';
      const savedStartNumber =
        localStorage.getItem('channel-numbering-start') || '1';

      const startingChannelNumberValue =
        savedMode === 'provider'
          ? null
          : savedMode === 'auto'
            ? 0
            : Number(savedStartNumber);

      await executeChannelCreation(
        startingChannelNumberValue,
        defaultProfileIds
      );
    } else {
      // Show the modal to let user choose
      setChannelNumberingModalOpen(true);
    }
  };

  // Separate function to actually execute the channel creation
  const executeChannelCreation = async (
    startingChannelNumberValue,
    profileIds = null
  ) => {
    try {
      // Convert profile selection: 'all' means all profiles (null), 'none' means no profiles ([]), specific IDs otherwise
      let channelProfileIds;
      if (profileIds) {
        if (profileIds.includes('none')) {
          channelProfileIds = [];
        } else if (profileIds.includes('all')) {
          channelProfileIds = null;
        } else {
          channelProfileIds = profileIds
            .filter((id) => id !== 'all' && id !== 'none')
            .map((id) => parseInt(id));
        }
      } else {
        channelProfileIds =
          selectedProfileId !== '0' ? [parseInt(selectedProfileId)] : null;
      }

      // Use the async API for all bulk operations
      const response = await API.createChannelsFromStreamsAsync(
        selectedStreamIds,
        channelProfileIds,
        startingChannelNumberValue
      );

      console.log(
        `Bulk creation task started: ${response.task_id} for ${response.stream_count} streams`
      );

      // Clear selection since the task has started
      setSelectedStreamIds([]);

      // Note: This is a background task, so the update happens on WebSocket completion
    } catch (error) {
      console.error('Error starting bulk channel creation:', error);
      // Error notifications will be handled by WebSocket
    }
  };

  // Handle confirming the channel numbering modal
  const handleChannelNumberingConfirm = async () => {
    // Save the choice if user wants to remember it
    if (rememberChoice) {
      suppressWarning('channel-numbering-choice');
      localStorage.setItem('channel-numbering-mode', numberingMode);
      if (numberingMode === 'custom') {
        localStorage.setItem(
          'channel-numbering-start',
          customStartNumber.toString()
        );
      }
    }

    // Convert mode to API value
    const startingChannelNumberValue =
      numberingMode === 'provider'
        ? null
        : numberingMode === 'auto'
          ? 0
          : Number(customStartNumber);

    setChannelNumberingModalOpen(false);
    await executeChannelCreation(
      startingChannelNumberValue,
      bulkSelectedProfileIds
    );
  };

  const editStream = async (stream = null) => {
    setStream(stream);
    setModalOpen(true);
  };

  const deleteStream = async (id) => {
    // Get stream details for the confirmation dialog
    const streamObj = data.find((s) => s.id === id);
    setStreamToDelete(streamObj);
    setDeleteTarget(id);
    setIsBulkDelete(false);

    // Skip warning if it's been suppressed
    if (isWarningSuppressed('delete-stream')) {
      return executeDeleteStream(id);
    }

    setConfirmDeleteOpen(true);
  };

  const executeDeleteStream = async (id) => {
    setDeleting(true);
    setIsLoading(true);
    try {
      await API.deleteStream(id);
      // Clear the selection for the deleted stream
      setSelectedStreamIds([]);
      table.resetRowSelection();
    } finally {
      setDeleting(false);
      setIsLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  const deleteStreams = async () => {
    setIsBulkDelete(true);
    setStreamToDelete(null);

    // Skip warning if it's been suppressed
    if (isWarningSuppressed('delete-streams')) {
      return executeDeleteStreams();
    }

    setConfirmDeleteOpen(true);
  };

  const executeDeleteStreams = async () => {
    setDeleting(true);
    setIsLoading(true);
    try {
      await API.deleteStreams(selectedStreamIds);
      setSelectedStreamIds([]);
      table.resetRowSelection();
    } finally {
      setDeleting(false);
      setIsLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  const closeStreamForm = async () => {
    setStream(null);
    setModalOpen(false);
    setIsLoading(true);
    try {
      await API.requeryStreams();
    } finally {
      setIsLoading(false);
    }
  };

  // Single channel creation functions
  const createChannelFromStream = async (stream) => {
    // Set default profile selection based on current profile filter
    const defaultProfileIds =
      selectedProfileId === '0' ? ['all'] : [selectedProfileId];
    setSingleSelectedProfileIds(defaultProfileIds);

    // Check if user has suppressed the single channel numbering dialog
    const actionKey = 'single-channel-numbering-choice';
    if (isWarningSuppressed(actionKey)) {
      // Use the remembered settings or default to 'provider' mode
      const savedMode =
        localStorage.getItem('single-channel-numbering-mode') || 'provider';
      const savedChannelNumber =
        localStorage.getItem('single-channel-numbering-specific') || '1';

      const channelNumberValue =
        savedMode === 'provider'
          ? null
          : savedMode === 'auto'
            ? 0
            : Number(savedChannelNumber);

      await executeSingleChannelCreation(
        stream,
        channelNumberValue,
        defaultProfileIds
      );
    } else {
      // Show the modal to let user choose
      setCurrentStreamForChannel(stream);
      setSingleChannelModalOpen(true);
    }
  };

  // Separate function to actually execute single channel creation
  const executeSingleChannelCreation = async (
    stream,
    channelNumber = null,
    profileIds = null
  ) => {
    // Convert profile selection: 'all' means all profiles (null), 'none' means no profiles ([]), specific IDs otherwise
    let channelProfileIds;
    if (profileIds) {
      if (profileIds.includes('none')) {
        channelProfileIds = [];
      } else if (profileIds.includes('all')) {
        channelProfileIds = null;
      } else {
        channelProfileIds = profileIds
          .filter((id) => id !== 'all' && id !== 'none')
          .map((id) => parseInt(id));
      }
    } else {
      channelProfileIds =
        selectedProfileId !== '0' ? [parseInt(selectedProfileId)] : null;
    }

    await API.createChannelFromStream({
      name: stream.name,
      channel_number: channelNumber,
      stream_id: stream.id,
      channel_profile_ids: channelProfileIds,
    });
    await API.requeryChannels();
  };

  // Handle confirming the single channel numbering modal
  const handleSingleChannelNumberingConfirm = async () => {
    // Save the choice if user wants to remember it
    if (rememberSingleChoice) {
      suppressWarning('single-channel-numbering-choice');
      localStorage.setItem('single-channel-numbering-mode', singleChannelMode);
      if (singleChannelMode === 'specific') {
        localStorage.setItem(
          'single-channel-numbering-specific',
          specificChannelNumber.toString()
        );
      }
    }

    // Convert mode to API value
    const channelNumberValue =
      singleChannelMode === 'provider'
        ? null
        : singleChannelMode === 'auto'
          ? 0
          : Number(specificChannelNumber);

    setSingleChannelModalOpen(false);
    await executeSingleChannelCreation(
      currentStreamForChannel,
      channelNumberValue,
      singleSelectedProfileIds
    );
  };

  const addStreamsToChannel = async () => {
    await API.updateChannel({
      id: selectedChannelIds[0],
      streams: [
        ...new Set(
          channelSelectionStreams.map((s) => s.id).concat(selectedStreamIds)
        ),
      ],
    });
    await API.requeryChannels();
  };

  const onRowSelectionChange = (updatedIds) => {
    setSelectedStreamIds(updatedIds);
  };

  const onPageSizeChange = (e) => {
    const newPageSize = parseInt(e.target.value);
    setStoredPageSize(newPageSize);
    setPagination({
      ...pagination,
      pageSize: newPageSize,
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

  function handleWatchStream(streamHash) {
    let vidUrl = `/proxy/ts/stream/${streamHash}`;
    if (env_mode == 'dev') {
      vidUrl = `${window.location.protocol}//${window.location.hostname}:5656${vidUrl}`;
    }
    showVideo(vidUrl);
  }

  const onSortingChange = (column) => {
    const sortField = sorting[0]?.id;
    const sortDirection = sorting[0]?.desc;

    if (sortField === column) {
      if (sortDirection === false) {
        setSorting([
          {
            id: column,
            desc: true,
          },
        ]);
      } else {
        // Reset to default sort (name ascending) instead of clearing
        setSorting([{ id: 'name', desc: false }]);
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

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getRowId: (row) => String(row.id), // Use channel ID as row ID
    state: {
      pagination,
      sorting,
      columnFilters,
      columnSizing,
      rowSelection: rowSelection,
      columnVisibility,
    },
    enableRowSelection: true,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);

      console.log(newSelection);
      // Extract channel IDs from selection object and sync to store
      const selectedIds = Object.keys(newSelection)
        .filter((key) => newSelection[key])
        .map((id) => Number(id));
      setSelectedStreamIds(selectedIds);
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  // const table = useTable({
  //   columns,
  //   data,
  //   allRowIds,
  //   filters,
  //   pagination,
  //   sorting,
  //   columnSizing,
  //   setColumnSizing,
  //   onColumnVisibilityChange: setColumnVisibility,
  //   onRowSelectionChange: onRowSelectionChange,
  //   manualPagination: true,
  //   manualSorting: true,
  //   manualFiltering: true,
  //   enableRowSelection: true,
  //   state: {
  //     pagination,
  //     sorting,
  //     columnVisibility,
  //   },
  //   headerCellRenderFns: {
  //     name: renderHeaderCell,
  //     group: renderHeaderCell,
  //     m3u: renderHeaderCell,
  //     tvg_id: renderHeaderCell,
  //     stats: renderHeaderCell,
  //   },
  //   bodyCellRenderFns: {
  //     actions: renderBodyCell,
  //   },
  //   getRowStyles: (row) => {
  //     if (row.original.is_stale) {
  //       return {
  //         backgroundColor: 'rgba(239, 68, 68, 0.15)',
  //       };
  //     }
  //     return {};
  //   },
  // });

  /**
   * useEffects
   */
  useEffect(() => {
    // Load data independently, don't wait for logos or other data
    fetchData();
  }, [fetchData]);

  // Refetch data when video player closes to update stream stats
  const prevVideoVisible = useRef(false);
  useEffect(() => {
    if (prevVideoVisible.current && !videoIsVisible) {
      // Video was closed, refetch to get updated stream stats
      fetchData({ showLoader: false });
    }
    prevVideoVisible.current = videoIsVisible;
  }, [videoIsVisible, fetchData]);

  useEffect(() => {
    if (
      Object.keys(channelGroups).length > 0 ||
      hasFetchedChannelGroups.current
    ) {
      return;
    }

    const loadGroups = async () => {
      hasFetchedChannelGroups.current = true;
      try {
        await fetchChannelGroups();
      } catch (error) {
        console.error('Error fetching channel groups:', error);
      }
    };

    loadGroups();
  }, [channelGroups, fetchChannelGroups]);

  useEffect(() => {
    if (
      playlists.length > 0 ||
      hasFetchedPlaylists.current ||
      playlistsLoading
    ) {
      return;
    }

    const loadPlaylists = async () => {
      hasFetchedPlaylists.current = true;
      try {
        await fetchPlaylists();
      } catch (error) {
        console.error('Error fetching playlists:', error);
      }
    };

    loadPlaylists();
  }, [playlists, fetchPlaylists, playlistsLoading]);

  useEffect(() => {
    const startItem = pagination.pageIndex * pagination.pageSize + 1;
    const endItem = Math.min(
      (pagination.pageIndex + 1) * pagination.pageSize,
      totalCount
    );
    setPaginationString(`${startItem} to ${endItem} of ${totalCount}`);
  }, [pagination.pageIndex, pagination.pageSize, totalCount]);

  // Clear dependent filters if selected values are no longer in filtered options
  useEffect(() => {
    // Clear group filter if the selected groups are no longer available
    if (filters.channel_group) {
      const selectedGroups = filters.channel_group.split(',').filter(Boolean);
      const stillValid = selectedGroups.filter((group) =>
        groupOptions.includes(group)
      );

      if (stillValid.length !== selectedGroups.length) {
        table.getColumn('channel_group')?.setFilterValue(stillValid.join(','));
      }
    }

    // Clear M3U filter if the selected M3Us are no longer available
    if (filters.m3u_account) {
      const selectedIds = filters.m3u_account.split(',').filter(Boolean);
      const availableIds = m3uOptions.map((opt) => opt.value);
      const stillValid = selectedIds.filter((id) => availableIds.includes(id));

      if (stillValid.length !== selectedIds.length) {
        table.getColumn('m3u')?.setFilterValue(stillValid.join(','));
      }
    }
  }, [groupOptions, m3uOptions, filters.channel_group, filters.m3u_account]);

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const row = rows[index];
        // Provide a larger estimate for expanded rows so initial placement is closer
        return row?.getIsExpanded() ? 300 : 41;
      },
      [rows]
    ),
    // Use ResizeObserver-based measurement for accurate dynamic heights.
    // Firefox has a known issue with getBoundingClientRect inside tables, so we
    // fall back to estimate-only there.
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 25,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  // Padding rows account for the height of off-screen items above and below
  // the rendered window without requiring absolute positioning.
  const paddingTop =
    virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() -
        (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center">
          <h1 className="text-2xl tracking-tight">Streams</h1>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex justify-between">
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`cursor-pointer rounded-sm border-1 ${selectedStreamIds.length > 0 && selectedChannelIds.length === 1 ? 'border-[var(--success)] bg-green-200 dark:bg-green-950' : 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed'}`}
                onClick={addStreamsToChannel}
                disabled={
                  !(
                    selectedStreamIds.length > 0 &&
                    selectedChannelIds.length === 1
                  )
                }
              >
                <Plus />
                Add to Channel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add selected stream(s) to the selected channel
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`cursor-pointer rounded-sm border-1`}
                onClick={createChannelsFromStreams}
                disabled={selectedStreamIds.length == 0}
              >
                <Plus />
                Create Channels ({selectedStreamIds.length})
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {`Create channels from ${selectedStreamIds.length} stream(s)`}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-8 cursor-pointer"
              >
                <Filter />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-45">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={toggleUnassignedOnly}
              >
                {filters.unassigned === true ? (
                  <SquareCheck size={18} />
                ) : (
                  <Square size={18} />
                )}
                Only Unassociated
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer"
                onClick={toggleHideStale}
              >
                {filters.hide_stale === true ? (
                  <SquareCheck size={18} />
                ) : (
                  <Square size={18} />
                )}
                Hide Stale
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`cursor-pointer border-[var(--success)] bg-green-200 dark:bg-green-950`}
                onClick={() => editStream()}
              >
                <SquarePlus />
                Create Stream
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create a new custom stream</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className={`cursor-pointer rounded-sm`}
                onClick={deleteStreams}
                disabled={selectedStreamIds.length == 0}
              >
                <SquareMinus />
                Delete
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete selected stream(s)</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-8 cursor-pointer"
              >
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => toggleColumnVisibility('name')}
                >
                  {columnVisibility.name !== false ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}{' '}
                  Name
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => toggleColumnVisibility('channel_group')}
                >
                  {columnVisibility.group !== false ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}{' '}
                  Group
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => toggleColumnVisibility('m3u')}>
                  {columnVisibility.m3u !== false ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}{' '}
                  M3u
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => toggleColumnVisibility('tvg_id')}
                >
                  {columnVisibility.tvg_id !== false ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}{' '}
                  TVG ID
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => toggleColumnVisibility('stats')}
                >
                  {columnVisibility.stats !== false ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}{' '}
                  Stats
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuItem onClick={resetColumnVisibility}>
                {<RotateCcw size={18} />} Reset Column Visibility
              </DropdownMenuItem>
              <DropdownMenuGroup></DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {initialDataCount === 0 ? (
        <div className="w-full h-full bg-secondary flex flex-col pt-10 rounded-md">
          <div className="flex items-center justify-center">
            <Card className="flex flex-col justify-center items-center max-w-1/2">
              <div className="font-bold text-lg text-center">
                Getting Started
              </div>
              <div className="text-[var(--inactive)] text-center px-10">
                In order to get started, add your M3U or start adding custom
                streams.
              </div>
              <Button onClick={() => navigate('/sources')}>Add M3u</Button>
              or
              <Button onClick={() => editStream()}>
                Add Individual Stream
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <div className="relative flex-1 min-h-0 rounded-md border">
            {!isLoading && rows.length > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md"
              >
                {Array.from({ length: rows.length - 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-border px-3"
                    style={{ height: '28px' }}
                  >
                    {/* Mirror the rough column layout for a realistic skeleton */}
                    <Skeleton className="h-3.5 w-4 shrink-0 opacity-30" />
                    <Skeleton className="h-3.5 w-4 shrink-0 opacity-30" />
                    <Skeleton className="h-3.5 w-8 shrink-0 opacity-30" />
                    <Skeleton className="h-3.5 flex-1 opacity-30" />
                    <Skeleton className="h-3.5 w-16 shrink-0 opacity-30" />
                    <Skeleton className="h-3.5 w-16 shrink-0 opacity-30" />
                    <Skeleton className="h-7 w-12 shrink-0 rounded opacity-30" />
                    <Skeleton className="h-3.5 w-16 shrink-0 opacity-30" />
                  </div>
                ))}
              </div>
            )}

            <div
              ref={tableContainerRef}
              className="scrollbar-overlay absolute inset-0 overflow-auto rounded-md"
            >
              <table
                style={{
                  minWidth: '100%',
                  width: '100%',
                  display: 'table',
                }}
                // @TODO-v2: implement table size
                className="table-compact"
                // className={`table-compact ${
                //   tableSize === 'compact'
                //     ? 'table-compact'
                //     : tableSize === 'large'
                //       ? 'table-large'
                //       : ''
                // }`}
              >
                {/* @TODO-v2: implement header pinned like channels table */}
                <TableHeader className={`top-0 z-10 !bg-background`}>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow
                      key={headerGroup.id}
                      style={{ display: 'flex', width: '100%' }}
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          className="content-center"
                          key={header.id}
                          style={{
                            ...(header.column.getCanResize()
                              ? {
                                  flex: `1 1 0`,
                                  minWidth: `${header.getSize()}px`,
                                }
                              : {
                                  flex: `0 0 ${header.getSize()}px`,
                                  width: `${header.getSize()}px`,
                                }),
                            position: 'relative',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                height: '100%',
                                width: '5px',
                                background: header.column.getIsResizing()
                                  ? 'rgba(59, 130, 246, 0.5)'
                                  : 'var(--background)',
                                cursor: 'col-resize',
                                userSelect: 'none',
                                touchAction: 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (!header.column.getIsResizing()) {
                                  e.currentTarget.style.background =
                                    'rgba(59, 130, 246, 0.3)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!header.column.getIsResizing()) {
                                  e.currentTarget.style.background =
                                    'var(--background)';
                                }
                              }}
                            />
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>

                {isLoading && (
                  <TableBody>
                    {Array.from({ length: pagination.pageSize }).map((_, i) => (
                      <TableRow
                        key={i}
                        style={{ display: 'flex', width: '100%' }}
                      >
                        {table.getAllColumns().map((column) => (
                          <TableCell
                            key={column.id}
                            style={{
                              ...(column.getCanResize()
                                ? {
                                    flex: `1 1 0`,
                                    minWidth: `${column.getSize()}px`,
                                  }
                                : {
                                    flex: `0 0 ${column.getSize()}px`,
                                    width: `${column.getSize()}px`,
                                  }),
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            <Skeleton className="my-1 h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                )}

                {/* Empty state */}
                {!isLoading && rows.length === 0 && (
                  <TableBody>
                    <TableRow style={{ display: 'flex', width: '100%' }}>
                      <TableCell
                        style={{ flex: '1 1 100%', width: '100%' }}
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No streams found
                      </TableCell>
                    </TableRow>
                  </TableBody>
                )}

                {!isLoading && rows.length > 0 && (
                  <>
                    {paddingTop > 0 && (
                      <tbody aria-hidden>
                        <tr>
                          <td
                            style={{
                              height: `${paddingTop}px`,
                              padding: 0,
                            }}
                          />
                        </tr>
                      </tbody>
                    )}

                    {virtualItems.map((virtualItem) => {
                      const row = rows[virtualItem.index];
                      return (
                        <tbody
                          key={row.id}
                          // data-index is read by measureElement to map back
                          // to the correct virtualizer entry.
                          data-index={virtualItem.index}
                          ref={(el) => rowVirtualizer.measureElement(el)}
                        >
                          <TableRow
                            style={{ display: 'flex', width: '100%' }}
                            data-state={row.getIsSelected() && 'selected'}
                            className={`bg-background ${
                              row.original.is_stale ? '!bg-red-900/80' : ''
                            }`}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                style={{
                                  ...(cell.column.getCanResize()
                                    ? {
                                        flex: `1 1 0`,
                                        minWidth: `${cell.column.getSize()}px`,
                                      }
                                    : {
                                        flex: `0 0 ${cell.column.getSize()}px`,
                                        width: `${cell.column.getSize()}px`,
                                      }),
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        </tbody>
                      );
                    })}

                    {paddingBottom > 0 && (
                      <tbody aria-hidden>
                        <tr>
                          <td
                            style={{
                              height: `${paddingBottom}px`,
                              padding: 0,
                            }}
                          />
                        </tr>
                      </tbody>
                    )}
                  </>
                )}
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Page Size</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) => {
                  setPagination({
                    ...pagination,
                    pageSize: Number(value),
                    pageIndex: 0,
                  });
                }}
              >
                <SelectTrigger className="h-8 w-[75px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 250].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SmartPagination
              currentPage={pagination.pageIndex + 1}
              totalPages={pageCount}
              onPageChange={(page) =>
                setPagination({ ...pagination, pageIndex: page - 1 })
              }
            />
          </div>
        </div>
      )}

      <CreateChannelFromStreamForm
        opened={channelNumberingModalOpen}
        onClose={() => setChannelNumberingModalOpen(false)}
        mode={numberingMode}
        onModeChange={setNumberingMode}
        numberValue={customStartNumber}
        onNumberValueChange={setCustomStartNumber}
        rememberChoice={rememberChoice}
        onRememberChoiceChange={setRememberChoice}
        onConfirm={handleChannelNumberingConfirm}
        isBulk={true}
        streamCount={selectedStreamIds.length}
        selectedProfileIds={bulkSelectedProfileIds}
        onProfileIdsChange={setBulkSelectedProfileIds}
        channelProfiles={channelProfiles ? Object.values(channelProfiles) : []}
      />

      <CreateChannelFromStreamForm
        opened={singleChannelModalOpen}
        onClose={() => setSingleChannelModalOpen(false)}
        mode={singleChannelMode}
        onModeChange={setSingleChannelMode}
        numberValue={specificChannelNumber}
        onNumberValueChange={setSpecificChannelNumber}
        rememberChoice={rememberSingleChoice}
        onRememberChoiceChange={setRememberSingleChoice}
        onConfirm={handleSingleChannelNumberingConfirm}
        isBulk={false}
        streamName={currentStreamForChannel?.name}
        selectedProfileIds={singleSelectedProfileIds}
        onProfileIdsChange={setSingleSelectedProfileIds}
        channelProfiles={channelProfiles ? Object.values(channelProfiles) : []}
      />

      <ConfirmationDialog
        opened={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() =>
          isBulkDelete
            ? executeDeleteStreams()
            : executeDeleteStream(deleteTarget)
        }
        title={`Confirm ${isBulkDelete ? 'Bulk ' : ''}Stream Deletion`}
        message={
          isBulkDelete ? (
            `Are you sure you want to delete ${selectedStreamIds.length} stream${selectedStreamIds.length !== 1 ? 's' : ''}? This action cannot be undone.`
          ) : streamToDelete ? (
            <div style={{ whiteSpace: 'pre-line' }}>
              {`Are you sure you want to delete the following stream?

      Name: ${streamToDelete.name}
      ${streamToDelete.channel_group ? `Group: ${channelGroups[streamToDelete.channel_group]?.name || 'Unknown'}` : ''}
      ${streamToDelete.m3u_account ? `M3U Account: ${playlists.find((p) => p.id === streamToDelete.m3u_account)?.name || 'Unknown'}` : ''}

      This action cannot be undone.`}
            </div>
          ) : (
            'Are you sure you want to delete this stream? This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        actionKey={isBulkDelete ? 'delete-streams' : 'delete-stream'}
        onSuppressChange={suppressWarning}
        loading={deleting}
        size="md"
      />

      <StreamForm
        stream={stream}
        isOpen={modalOpen}
        onClose={closeStreamForm}
      />
    </div>
  );
};

export default StreamsTable;
