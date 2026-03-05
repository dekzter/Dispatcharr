import ConfirmationDialog from '@/components/ConfirmationDialog';
import LazyLogo from '@/components/dispatcharr/lazy-logo';
import { SearchableInput } from '@/components/dispatcharr/searchable-input';
import { SmartPagination } from '@/components/SmartPagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useChannelLogoSelection } from '@/hooks/use-smart-logos';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import API from '@/lib/api';
import { USER_LEVELS } from '@/lib/constants';
import { copyToClipboard, useDebounce } from '@/lib/utils';
import useAuthStore from '@/store/auth';
import useChannelsStore from '@/store/channels';
import useChannelsTableStore from '@/store/channelsTable';
import useEPGsStore from '@/store/epgs';
import useSettingsStore from '@/store/settings';
import useVideoStore from '@/store/useVideoStore';
import useWarningsStore from '@/store/warnings';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlignJustify,
  ArrowDown,
  ArrowDown01,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  Copy,
  Edit,
  EllipsisVertical,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  Lock,
  Pin,
  PinOff,
  ScreenShare,
  Settings,
  Square,
  SquareCheck,
  SquareMinus,
  SquarePen,
  SquarePlus,
  Trash2,
  Tv2,
  Unlock
} from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AssignChannelNumbersForm from './AssignChannelNumbersForm';
import ChannelForm from './ChannelForm';
import ChannelRecordingForm from './ChannelRecordingForm';
import ChannelsTableOnboarding from './ChannelsTableOnboarding';
import ChannelTableStreams from './ChannelTableStreams';
import CreateProfilePopover from './CreateProfilePopover';
import {
  EditableEPGCell,
  EditableGroupCell,
  EditableLogoCell,
  EditableTextCell,
} from './EditableCell';
import EPGMatchForm from './EPGMatchForm';
import GroupManager from './GroupManager';
import ProfileForm from './ProfileForm';

// DraggableRow must be defined at module level (not inside the parent component)
// so that its component type identity is stable across re-renders.  Defining it
// inside a render function gives it a new reference every render, causing React
// to unmount and remount it whenever the parent re-renders (e.g. after a
// virtualizer measurement update), which destroys any focused input.
const DraggableRow = React.memo(
  ({ row }: { row: any }) => {
    // Read directly from the store — no prop needed, stable reference.
    const isUnlocked = useChannelsTableStore((s) => s.isUnlocked);

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: row.id,
      disabled: !isUnlocked,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <>
        <TableRow
          ref={setNodeRef}
          style={{ ...style, display: 'flex', width: '100%' }}
          data-state={row.getIsSelected() && 'selected'}
          className={`bg-background ${
            row.original.streams && row.original.streams.length > 0
              ? ''
              : '!bg-red-900/80'
          }`}
        >
          {isUnlocked && (
            <TableCell
              className="w-[24px] p-0"
              style={{
                flex: '0 0 24px',
                cursor: isDragging ? 'grabbing' : 'grab',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              {...attributes}
              {...listeners}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <GripVertical size={16} opacity={0.5} />
              </div>
            </TableCell>
          )}
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
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
        {row.getIsExpanded() && (
          <TableRow
            style={{ ...style, display: 'flex', width: '100%' }}
            className="bg-primary/25"
          >
            <TableCell
              style={{ flex: '1 1 100%', width: '100%' }}
              colSpan={row.getVisibleCells().length + (isUnlocked ? 1 : 0)}
            >
              <ChannelTableStreams channel={row.original} isExpanded={true} />
            </TableCell>
          </TableRow>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Return true (skip re-render) when nothing meaningful has changed.
    return (
      prevProps.row.id === nextProps.row.id &&
      prevProps.row.getIsSelected() === nextProps.row.getIsSelected() &&
      prevProps.row.getIsExpanded() === nextProps.row.getIsExpanded() &&
      prevProps.row.original.streams.length ===
        nextProps.row.original.streams.length
    );
  }
);

type Channel = {
  id: number;
  channel_number: number;
  name: string;
  channel_group_id: number | null;
  enabled: boolean;
  streams: any[];
  logo_id: number | null;
  epg_data_id: number | null;
};

const ChannelSelectHeader = React.memo(({ table }) => {
  const channelIds = useChannelsStore((s) => s.channelIds);
  const selectedChannelIds = useChannelsTableStore((s) => s.selectedChannelIds);
  const setSelectedChannelIds = useChannelsTableStore(
    (s) => s.setSelectedChannelIds
  );

  return (
    <div className="flex items-center h-full">
      <Checkbox
        className="!h-4"
        checked={
          (channelIds.length > 0 &&
            selectedChannelIds.length === channelIds.length) ||
          (selectedChannelIds.length > 0 && 'indeterminate')
        }
        onCheckedChange={(value) => {
          table.toggleAllPageRowsSelected(!!value);
          // setLastSelectedIndex(null);
          setSelectedChannelIds(value ? channelIds : []);
        }}
        aria-label="Select all"
      />
    </div>
  );
});

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
      <Switch
        size="sm"
        checked={selectedProfileId === '0' || isEnabled}
        onCheckedChange={handleToggle}
        disabled={selectedProfileId === '0'}
      />
    );
  }
);

// Separate component for name column header with debounced filtering
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

export default function ChannelsTable({ onReady, baseUrl }) {
  const hasSignaledReady = useRef(false);
  const groupSearchRef = useRef<any>(null);
  const hasFetchedData = useRef(false);
  const fetchVersionRef = useRef(0); // Track fetch version to prevent stale updates
  const lastFetchParamsRef = useRef(null); // Track last fetch params to prevent duplicate requests
  const fetchInProgressRef = useRef(false); // Track if a fetch is currently in progress
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before dragging starts
      },
    })
  );

  // EPG data lookup
  const tvgsById = useEPGsStore((s) => s.tvgsById);
  const epgs = useEPGsStore((s) => s.epgs);
  const tvgsLoaded = useEPGsStore((s) => s.tvgsLoaded);

  const channels = useChannelsTableStore((s) => s.channels);
  const pagination = useChannelsTableStore((s) => s.pagination);
  const sorting = useChannelsTableStore((s) => s.sorting);
  const totalCount = useChannelsTableStore((s) => s.totalCount);
  const pageCount = useChannelsTableStore((s) => s.pageCount);
  const selectedChannelIds = useChannelsTableStore((s) => s.selectedChannelIds);
  const setPagination = useChannelsTableStore((s) => s.setPagination);
  const setSorting = useChannelsTableStore((s) => s.setSorting);
  const setSelectedChannelIds = useChannelsTableStore(
    (s) => s.setSelectedChannelIds
  );
  const channelGroups = useChannelsStore((s) => s.channelGroups);
  const isUnlocked = useChannelsTableStore((s) => s.isUnlocked);
  const setIsUnlocked = useChannelsTableStore((s) => s.setIsUnlocked);
  const setAllRowIds = useChannelsTableStore((s) => s.setAllQueryIds);

  const channelIds = useChannelsStore((s) => s.channelIds);

  const isWarningSuppressed = useWarningsStore((s) => s.isWarningSuppressed);
  const suppressWarning = useWarningsStore((s) => s.suppressWarning);
  const env_mode = useSettingsStore((s) => s.environment.env_mode);
  const showVideo = useVideoStore((s) => s.showVideo);
  const authUser = useAuthStore((s) => s.user);
  const selectedProfileId = useChannelsStore((s) => s.selectedProfileId);
  const setSelectedProfileId = useChannelsStore((s) => s.setSelectedProfileId);
  const profiles = useChannelsStore((s) => s.profiles);

  const { tableSize, setTableSize } = useTablePreferences();

  const [isLoading, setIsLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnSizing, setColumnSizing] = useState({});
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(
    null
  );

  const [assignNumbersModalOpen, setAssignNumbersModalOpen] = useState(false);
  const [epgMatchModalOpen, setEpgMatchModalOpen] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [editingChannel, setEditingChannel] = useState(null);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showOnlyStreamlessChannels, setShowOnlyStreamlessChannels] =
    useState(false);
  const [profileModalState, setProfileModalState] = useState({
    opened: false,
    mode: null,
    profileId: null,
  });
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [confirmDeleteProfileOpen, setConfirmDeleteProfileOpen] =
    useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [channel, setChannel] = useState(null);
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);

  const { ensureLogosLoaded } = useChannelLogoSelection();

  // @TODO-v2: implement table size
  const {
    headerPinned,
    setHeaderPinned,
    // tableSize, setTableSize
  } = useTablePreferences();

  const [hdhrUrl, setHDHRUrl] = useState(`${baseUrl}/hdhr`);
  const [epgUrl, setEPGUrl] = useState(`${baseUrl}/output/epg`);
  const [m3uUrl, setM3UUrl] = useState(`${baseUrl}/output/m3u`);

  const [m3uParams, setM3uParams] = useState({
    cachedlogos: true,
    direct: false,
    tvg_id_source: 'channel_number',
  });
  const [epgParams, setEpgParams] = useState({
    cachedlogos: true,
    tvg_id_source: 'channel_number',
    days: 0,
  });

  const [deleting, setDeleting] = useState(false);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Build initial row selection from selectedChannelIds
  useEffect(() => {
    const newRowSelection: Record<string, boolean> = {};
    selectedChannelIds.forEach((id: number) => {
      newRowSelection[String(id)] = true;
    });
    setRowSelection(newRowSelection);
  }, [selectedChannelIds]);

  const debouncedFilters = useDebounce(columnFilters, 500, () => {
    setPagination({
      ...pagination,
      pageIndex: 0,
    });
  });

  /**
   * Functions
   */
  const fetchData = useCallback(async () => {
    console.log(columnFilters);

    // Build params first to check for duplicates
    const params = new URLSearchParams();
    params.append('page', pagination.pageIndex + 1);
    params.append('page_size', pagination.pageSize);
    params.append('include_streams', 'true');
    if (selectedProfileId !== '0') {
      params.append('channel_profile_id', selectedProfileId);
    }
    if (showDisabled === true) {
      params.append('show_disabled', true);
    }
    if (showOnlyStreamlessChannels === true) {
      params.append('only_streamless', true);
    }

    // Apply sorting
    if (sorting.length > 0) {
      const sortField = sorting[0].id;
      const sortDirection = sorting[0].desc ? '-' : '';
      params.append('ordering', `${sortDirection}${sortField}`);
    }

    // Apply debounced filters
    debouncedFilters.forEach(({ id, value }) => {
      if (value) {
        if (Array.isArray(value)) {
          // Convert null values to "null" string for URL parameter
          const processedValue = value
            .map((v) => (v === null ? 'null' : v))
            .join(',');
          params.append(id, processedValue);
        } else {
          params.append(id, value);
        }
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

    setIsLoading(true);

    try {
      const [results, ids] = await Promise.all([
        API.queryChannels(params),
        API.getAllChannelIds(params),
      ]);

      fetchInProgressRef.current = false;

      // Skip state updates if a newer fetch has been initiated
      if (currentFetchVersion !== fetchVersionRef.current) {
        return;
      }

      setIsLoading(false);
      hasFetchedData.current = true;

      // setTablePrefs((prev) => ({
      //   ...prev,
      //   pageSize: pagination.pageSize,
      // }));
      setAllRowIds(ids);

      // Signal ready after first successful data fetch AND EPG data is loaded
      // This prevents the EPG column from showing "Not Assigned" while EPG data is still loading
      if (!hasSignaledReady.current && onReady && tvgsLoaded) {
        hasSignaledReady.current = true;
        onReady();
      }
    } catch (error) {
      fetchInProgressRef.current = false;

      // Skip state updates if a newer fetch has been initiated
      if (currentFetchVersion !== fetchVersionRef.current) {
        return;
      }
      setIsLoading(false);
      // API layer handles "Invalid page" errors by resetting and retrying
      // Just re-throw to show notification for actual errors
      throw error;
    }
  }, [
    pagination,
    sorting,
    debouncedFilters,
    showDisabled,
    selectedProfileId,
    showOnlyStreamlessChannels,
  ]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const rows = table.getRowModel().rows;
    const activeIndex = rows.findIndex((row) => row.id === active.id);
    const overIndex = rows.findIndex((row) => row.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      return;
    }

    const activeChannel = rows[activeIndex].original;
    const overChannel = rows[overIndex].original;

    try {
      // Optimistically update the local state
      const reorderedData = [...channels];
      const [movedItem] = reorderedData.splice(activeIndex, 1);
      reorderedData.splice(overIndex, 0, movedItem);
      useChannelsTableStore.setState({ channels: reorderedData });

      // Call backend to reorder
      await API.reorderChannel(
        activeChannel.id,
        overIndex > activeIndex
          ? overChannel.id
          : rows[overIndex - 1]?.original.id || null
      );

      // Refetch to get updated channel numbers
      await API.requeryChannels();
    } catch (error) {
      // Revert on error
      console.error('Failed to reorder channel:', error);
      await API.requeryChannels();
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const editChannel = async (ch = null, opts = {}) => {
    // If forceAdd is set, always open a blank form
    if (opts.forceAdd) {
      setEditingChannel(null);
      setChannelModalOpen(true);
      return;
    }
    // Use table's selected state instead of store state to avoid stale selections
    const currentSelection = table ? selectedChannelIds : [];
    // console.log('editChannel called with:', {
    //   ch,
    //   currentSelection,
    //   tableExists: !!table,
    // });

    if (currentSelection.length > 1) {
      // setChannelBatchModalOpen(true);
    } else {
      // If no channel object is passed but we have a selection, get the selected channel
      let channelToEdit = ch;
      if (!channelToEdit && currentSelection.length === 1) {
        const selectedId = currentSelection[0];

        // Use table data since that's what's currently displayed
        channelToEdit = data.find((d) => d.id === selectedId);
      }
      setEditingChannel(channelToEdit);
      setChannelModalOpen(true);
    }
  };

  const deleteChannel = async (id) => {
    console.log(`Deleting channel with ID: ${id}`);

    const rows = table.getRowModel().rows;
    const knownChannel = rows.find((row) => row.original.id === id)?.original;

    table.resetRowSelection();

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
    setChannelToDelete(knownChannel); // Store the channel object for displaying details

    if (isWarningSuppressed('delete-channel')) {
      // Skip warning if suppressed
      return executeDeleteChannel(id);
    }

    setConfirmDeleteOpen(true);
  };

  const executeDeleteChannel = async (id: number) => {
    setDeleting(true);
    try {
      await API.deleteChannel(id);
      API.requeryChannels();
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
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
    setDeleting(true);
    try {
      await API.deleteChannels(selectedChannelIds);
      await API.requeryChannels();
      setSelectedChannelIds([]);
      table.resetRowSelection();
    } finally {
      setDeleting(false);
      setIsLoading(false);
      setConfirmDeleteOpen(false);
    }
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

  // Build URLs with parameters
  const buildM3UUrl = () => {
    const params = new URLSearchParams();
    if (!m3uParams.cachedlogos) params.append('cachedlogos', 'false');
    if (m3uParams.direct) params.append('direct', 'true');
    if (m3uParams.tvg_id_source !== 'channel_number')
      params.append('tvg_id_source', m3uParams.tvg_id_source);

    const baseUrl = m3uUrl;
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  };

  const buildEPGUrl = () => {
    const params = new URLSearchParams();
    if (!epgParams.cachedlogos) params.append('cachedlogos', 'false');
    if (epgParams.tvg_id_source !== 'channel_number')
      params.append('tvg_id_source', epgParams.tvg_id_source);
    if (epgParams.days > 0) params.append('days', epgParams.days.toString());

    const baseUrl = epgUrl;
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  };

  const copyM3UUrl = async () => {
    await copyToClipboard(buildM3UUrl(), {
      successTitle: 'M3U URL Copied!',
      successMessage: 'The M3U URL has been copied to your clipboard.',
    });
  };

  const copyEPGUrl = async () => {
    await copyToClipboard(buildEPGUrl(), {
      successTitle: 'EPG URL Copied!',
      successMessage: 'The EPG URL has been copied to your clipboard.',
    });
  };

  const copyHDHRUrl = async () => {
    await copyToClipboard(hdhrUrl, {
      successTitle: 'HDHR URL Copied!',
      successMessage: 'The HDHR URL has been copied to your clipboard.',
    });
  };

  const createNewProfile = async () => {
    await API.addChannelProfile({ name: newProfileName });
    setNewProfileName('');
  };

  // Signal ready when EPG data finishes loading (if channels were already fetched)
  useEffect(() => {
    if (
      hasFetchedData.current &&
      !hasSignaledReady.current &&
      onReady &&
      tvgsLoaded
    ) {
      hasSignaledReady.current = true;
      onReady();
    }
  }, [tvgsLoaded, onReady]);

  const onEditProfile = (mode, profileId) => {
    if (!profiles[profileId]) {
      return;
    }

    setProfileModalState({ opened: true, mode, profileId });
  };

  const deleteProfile = async (id) => {
    // Get profile details for the confirmation dialog
    const profileObj = profiles[id];
    setProfileToDelete(profileObj);

    // Skip warning if it's been suppressed
    if (isWarningSuppressed('delete-profile')) {
      return executeDeleteProfile(id);
    }

    setConfirmDeleteProfileOpen(true);
  };

  const executeDeleteProfile = async (id) => {
    setDeletingProfile(true);
    try {
      await API.deleteChannelProfile(id);
    } finally {
      setDeletingProfile(false);
      setConfirmDeleteProfileOpen(false);
    }
  };

  const columns = useMemo<ColumnDef<Channel>[]>(
    () => [
      {
        id: 'expand',
        size: 30,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex h-full items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => row.toggleExpanded()}
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        ),
      },
      {
        id: 'select',
        size: 30,
        enableResizing: false,
        header: ({ table }) => <ChannelSelectHeader table={table} />,
        cell: ({ row, table }) => (
          <Checkbox
            className="!h-4"
            checked={row.getIsSelected()}
            onCheckedChange={(value) => {
              row.toggleSelected(!!value);
              setLastSelectedIndex(row.index);
            }}
            onClick={(e: React.MouseEvent) => {
              const currentIndex = row.index;

              if (e.shiftKey && lastSelectedIndex !== null) {
                e.preventDefault();
                e.stopPropagation();

                // Shift+click: select range
                const start = Math.min(lastSelectedIndex, currentIndex);
                const end = Math.max(lastSelectedIndex, currentIndex);
                const rows = table.getRowModel().rows;

                // Determine if we're selecting or deselecting based on the target row
                const shouldSelect = !rows[currentIndex]?.getIsSelected();

                // Select/deselect all rows in range
                for (let i = start; i <= end; i++) {
                  if (rows[i]) {
                    rows[i].toggleSelected(shouldSelect);
                  }
                }

                setLastSelectedIndex(currentIndex);
              }
            }}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'enabled',
        size: 35,
        enableResizing: false,
        enableHiding: false,
        enableSorting: false,
        header: ({ table }) => {},
        cell: ({ row, table }) => (
          <div className="flex h-full items-center">
            <ChannelEnabledSwitch
              rowId={row.original.id}
              selectedProfileId={selectedProfileId}
              selectedTableIds={selectedChannelIds}
            />
          </div>
        ),
      },
      {
        accessorKey: 'channel_number',
        size: 50,
        enableResizing: false,
        header: ({ column }) => {
          return (
            <div className="flex items-center justify-end space-y-2">
              #
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === 'asc')
                }
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
        },
        cell: ({ row }) => (
          <div className="text-right overflow-hidden text-ellipsis whitespace-nowrap content-center h-full">
            {row.getValue('channel_number')}
          </div>
        ),
      },
      {
        accessorKey: 'name',
        enableResizing: true,
        header: ({ column }) => <NameColumnHeader column={column} />,
        cell: (props) => (
          <div className="font-medium overflow-hidden text-ellipsis whitespace-nowrap h-full content-center">
            <EditableTextCell {...props} />
          </div>
        ),
      },
      {
        id: 'epg',
        accessorKey: 'epg_data_id',
        size: 80,
        enableResizing: true,
        enableSorting: false,
        header: ({ column }) => {
          return (
            <div className="space-y-2 flex">
              <div className="flex items-center justify-center gap-2 pr-3">
                <SearchableInput
                  className="h-6"
                  placeholder="EPG"
                  options={Object.values(epgs).map((epg) => ({
                    label: epg.name,
                    value: epg.id,
                  }))}
                  allowMultiple={true}
                  onSelect={(values) => {
                    column.setFilterValue(values.map((v) => v.label).join(','));
                  }}
                  autoFocus={false}
                  clearable={true}
                />
              </div>
            </div>
          );
        },
        cell: (props) => (
          <EditableEPGCell
            {...props}
            tvgsById={tvgsById}
            epgs={epgs}
            tvgsLoaded={tvgsLoaded}
          />
        ),
      },
      {
        id: 'channel_group',
        enableResizing: true,
        enableSorting: false,
        accessorFn: (row) => {
          if (!channelGroups || !row.channel_group_id) {
            return '';
          }
          return channelGroups[row.channel_group_id]?.name || '';
        },
        header: ({ column }) => {
          return (
            <div className="space-y-2 flex">
              <div className="flex items-center justify-center gap-2 pr-3">
                <SearchableInput
                  className="h-6"
                  placeholder="Groups"
                  options={Object.values(channelGroups).map((group) => ({
                    label: group.name,
                    value: group.id,
                  }))}
                  allowMultiple={true}
                  ref={groupSearchRef}
                  onSelect={(values) => {
                    console.log(values);
                    column.setFilterValue(values.map((v) => v.label).join(','));
                  }}
                  autoFocus={false}
                  clearable={true}
                />
              </div>
            </div>
          );
        },
        cell: (props) => (
          <EditableGroupCell {...props} channelGroups={channelGroups} />
        ),
      },
      {
        id: 'logo',
        accessorFn: (row) => {
          // Just pass the logo_id directly, not the full logo object
          return row.logo_id;
        },
        header: '',
        size: 75,
        enableResizing: false,
        cell: (props) => (
          <EditableLogoCell
            {...props}
            LazyLogo={LazyLogo}
            ensureLogosLoaded={ensureLogosLoaded}
          />
        ),
      },
      {
        id: 'actions',
        size: 90,
        enableResizing: false,
        cell: ({ row }) => {
          return (
            <div className="flex justify-between">
              <div
                role="button"
                variant="ghost"
                className="text-yellow-500 dark:text-yellow-300 h-4 w-4 p-0 cursor-pointer"
                onClick={() => editChannel(row.original)}
              >
                <Edit size={18} />
              </div>
              <div
                role="button"
                className="text-red-500 dark:text-red-500 h-4 w-4 p-0 cursor-pointer"
                onClick={() => deleteChannel(row.original.id)}
              >
                <Trash2 size={18} />
              </div>
              <div
                role="button"
                className="text-[var(--success)] h-4 w-4 p-0 cursor-pointer"
                onClick={() => handleWatchStream(row.original)}
              >
                <CirclePlay size={18} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    role="button"
                    className="text-blue-500 h-4 w-4 p-0 cursor-pointer"
                  >
                    <EllipsisVertical size={18} />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => {
                      copyToClipboard(getChannelURL(row.original), {
                        successTitle: 'Channel URL Copied!',
                        successMessage:
                          'The channel stream URL has been copied to your clipboard.',
                      });
                    }}
                  >
                    Copy URL
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => createRecording(row.original)}
                  >
                    Record
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [selectedProfileId, channelGroups, tvgsById, epgs]
  );

  const table = useReactTable({
    data: channels,
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
      expanded,
    },
    enableRowSelection: true,
    onExpandedChange: (updater) => {
      const newExpanded =
        typeof updater === 'function' ? updater(expanded) : updater;
      // Only allow one row to be expanded at a time
      const expandedKeys = Object.keys(newExpanded).filter(
        (key) => newExpanded[key as keyof typeof newExpanded]
      );
      const diff = Object.keys(newExpanded).filter(
        (item) => !Object.keys(expanded).includes(item)
      );
      setExpanded({ [diff[0]]: true });
    },
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);

      // Extract channel IDs from selection object and sync to store
      const selectedIds = Object.keys(newSelection)
        .filter((key) => newSelection[key])
        .map((id) => Number(id));
      setSelectedChannelIds(selectedIds);
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
          <h1 className="text-2xl tracking-tight">Channels</h1>
          <div className="flex px-2 items-center gap-2">
            <h3 className="text-sm text-muted-foreground">Links:</h3>

            <Popover>
              <PopoverTrigger asChild>
                <div className="cursor-pointer flex rounded-sm text-sm gap-2 border-1 px-2 py-0.5 items-center dark:text-lime-500 dark:border-lime-500 text-lime-700 border-lime-700 bg-lime-100 dark:bg-inherit">
                  <Tv2 size={16} />
                  HDHR
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <InputGroup>
                  <InputGroupInput placeholder={hdhrUrl} disabled />
                  <InputGroupAddon align="inline-end">
                    <div
                      role="button"
                      className="cursor-pointer"
                      onClick={copyHDHRUrl}
                    >
                      <Copy size={16} />
                    </div>
                  </InputGroupAddon>
                </InputGroup>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <div className="cursor-pointer flex rounded-sm text-sm gap-2 border-1 px-2 py-0.5 items-center text-indigo-500 border-indigo-500 dark:bg-inherit bg-indigo-100">
                  <ScreenShare size={16} />
                  M3U
                </div>
              </PopoverTrigger>
              <PopoverContent className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="m3u-url" className="font-light">
                    Generated URL
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="m3u-url"
                      placeholder={m3uUrl}
                      disabled
                    />
                    <InputGroupAddon align="inline-end">
                      <div
                        role="button"
                        className="cursor-pointer"
                        onClick={copyM3UUrl}
                      >
                        <Copy size={16} />
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="use-cached-logos" className="font-light">
                    Use Cached Logos
                  </Label>
                  <Switch
                    id="use-cached-logos"
                    checked={m3uParams.cachedlogos}
                    onCheckedChange={(val) =>
                      setM3uParams((prev) => ({
                        ...prev,
                        cachedlogos: val,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="direct-stream-urls" className="font-light">
                    Direct Stream URLs
                  </Label>
                  <Switch
                    id="direct-stream-urls"
                    checked={m3uParams.direct}
                    onCheckedChange={(val) =>
                      setM3uParams((prev) => ({
                        ...prev,
                        direct: val,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tvg-id-source" className="font-light">
                    TVG-ID Source
                  </Label>
                  <Select
                    value={m3uParams.tvg_id_source}
                    onValueChange={(value) =>
                      setM3uParams((prev) => ({
                        ...prev,
                        tvg_id_source: value,
                      }))
                    }
                  >
                    <SelectTrigger id="tvg-id-source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'channel_number', label: 'Channel Number' },
                        { value: 'tvg_id', label: 'TVG-ID' },
                        { value: 'gracenote', label: 'Gracenote Station ID' },
                      ].map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <div className="cursor-pointer flex rounded-sm text-sm gap-2 border-1 px-2 py-0.5 items-center text-zinc-500 border-zinc-500 dark:bg-inherit bg-zinc-100">
                  <ScreenShare size={16} />
                  EPG
                </div>
              </PopoverTrigger>
              <PopoverContent className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="epg-url" className="font-light">
                    Generated URL
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="epg-url"
                      placeholder={epgUrl}
                      disabled
                    />
                    <InputGroupAddon align="inline-end">
                      <div
                        role="button"
                        className="cursor-pointer"
                        onClick={copyEPGUrl}
                      >
                        <Copy size={16} />
                      </div>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="use-cached-logos" className="font-light">
                    Use Cached Logos
                  </Label>
                  <Switch
                    id="use-cached-logos"
                    checked={epgParams.cachedlogos}
                    onCheckedChange={(val) =>
                      setEpgParams((prev) => ({
                        ...prev,
                        cachedlogos: val,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tvg-id-source" className="font-light">
                    TVG-ID Source
                  </Label>
                  <Select
                    value={epgParams.tvg_id_source}
                    onValueChange={(value) =>
                      setEpgParams((prev) => ({
                        ...prev,
                        tvg_id_source: value,
                      }))
                    }
                  >
                    <SelectTrigger id="tvg-id-source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        { value: 'channel_number', label: 'Channel Number' },
                        { value: 'tvg_id', label: 'TVG-ID' },
                        { value: 'gracenote', label: 'Gracenote Station ID' },
                      ].map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="days" className="font-light">
                    Days (0 = all data)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={epgParams.days}
                    onChange={(e) =>
                      setEpgParams((prev) => ({
                        ...prev,
                        days: e.target.value || 0,
                      }))
                    }
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isUnlocked && (
          <div className="flex text-sm gap-1 pl-4 items-center text-yellow-500">
            <Unlock size={16} />
            Editing Mode
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="flex justify-between">
        <div className="flex items-center gap-1">
          <SearchableInput
            className="h-8"
            autoFocus={false}
            placeholder={profiles[selectedProfileId]?.name}
            options={Object.values(profiles).map((profile) => ({
              label: profile.name,
              value: profile.id,
            }))}
            onSelect={(option) => setSelectedProfileId(option.value)}
            rowRenderer={({ options, index, handleChange, value }) => {
              const option = options[index];
              const isActive = selectedProfileId === options[index].value;

              return (
                <div
                  onClick={() => {
                    handleChange(option, isActive);
                  }}
                >
                  <div className="cursor-pointer hover:bg-secondary flex items-center justify-between gap-2 py-1 px-2">
                    <div className="text-xs text-center overflow-hidden overflow-ellipsis whitespace-nowrap">
                      {option.label}
                    </div>
                    {option.value !== '0' && (
                      <div className="flex justify-end gap-1">
                        <div
                          role="button"
                          className="text-yellow-500 cursor-po inter"
                          onClick={() => onEditProfile('edit', option.value)}
                        >
                          <SquarePen size={16} />
                        </div>

                        <div
                          role="button"
                          className="text-[var(--success)] cursor-pointer"
                          onClick={() =>
                            onEditProfile('duplicate', option.value)
                          }
                        >
                          <Copy size={16} />
                        </div>

                        <div
                          role="button"
                          className="text-red-500 cursor-pointer"
                          onClick={() => deleteProfile(option.value)}
                        >
                          <SquareMinus size={16} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />

          <div className="cursor-pointer text-[var(--success)]">
            <CreateProfilePopover />
          </div>
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
                onClick={() => setShowDisabled(!showDisabled)}
              >
                {showDisabled ? <Eye size={18} /> : <EyeOff size={18} />}
                {showDisabled ? 'Hide Disabled' : 'Show Disabled'}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() =>
                  setShowOnlyStreamlessChannels(!showOnlyStreamlessChannels)
                }
              >
                {showOnlyStreamlessChannels ? (
                  <SquareCheck size={18} />
                ) : (
                  <Square size={18} />
                )}
                Only Empty Channels
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={editChannel}
            disabled={selectedChannelIds.length === 0}
          >
            <SquarePen className="h-4 w-4 rounded-sm" />
            Edit
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer"
            onClick={deleteChannels}
            disabled={selectedChannelIds.length === 0}
          >
            <SquareMinus />
            Delete
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={`cursor-pointer ${authUser.user_level != USER_LEVELS.ADMIN ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'border-[var(--success)] bg-green-200 dark:bg-green-950'}`}
            onClick={() => editChannel(null, { forceAdd: true })}
            disabled={authUser.user_level != USER_LEVELS.ADMIN}
          >
            <SquarePlus />
            Add
          </Button>

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
              <DropdownMenuItem onClick={() => setHeaderPinned(!headerPinned)}>
                {headerPinned ? (
                  <Pin className="mr-2 h-4 w-4" />
                ) : (
                  <PinOff className="mr-2 h-4 w-4" />
                )}
                {headerPinned ? 'Unpin Headers' : 'Pin Headers'}
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => setIsUnlocked(!isUnlocked)}>
                {isUnlocked ? (
                  <Unlock className="mr-2 h-4 w-4" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {isUnlocked ? 'Lock Table' : 'Unlock for Editing'}
              </DropdownMenuItem>

              <Separator />
              <DropdownMenuItem
                disabled={
                  selectedChannelIds.length === 0 ||
                  authUser.user_level != USER_LEVELS.ADMIN
                }
                onClick={() => setAssignNumbersModalOpen(true)}
              >
                <ArrowDown01 className="mr-2 h-4 w-4" />
                Assign #s
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={authUser.user_level != USER_LEVELS.ADMIN}
                onClick={() => setEpgMatchModalOpen(true)}
              >
                <AlignJustify className="mr-2 h-4 w-4" />
                {selectedChannelIds.length > 0
                  ? `Auto-Match (${selectedChannelIds.length} selected)`
                  : 'Auto-Match EPG'}
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={authUser.user_level != USER_LEVELS.ADMIN}
                onClick={() => setGroupManagerOpen(true)}
              >
                <Settings className="mr-2 h-4 w-4" />
                Edit Groups
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {channelIds.length === 0 ? (
        Object.keys(channels).length === 0 && (
          <ChannelsTableOnboarding editChannel={editChannel} />
        )
      ) : (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
          {/* Outer wrapper is position:relative so the skeleton layer and scroll
              container can both be position:absolute and fill it exactly. */}
          <div className="relative flex-1 min-h-0 rounded-md border">
            {/* Skeleton background — always mounted when data is present.
                It fills the visible viewport area (overflow:hidden clips it).
                Virtual rows rendered by TanStack Virtual sit above it via
                z-index and mask it with their opaque bg-background.
                The transparent padding-spacer <tbody> elements reveal the
                skeleton below, turning the previous "black gap" into a pulsing
                skeleton during fast scroll. No scroll-event handlers; pure CSS. */}
            {!isLoading && rows.length > 0 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md"
              >
                {Array.from({ length: rows.length }).map((_, i) => (
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={rows.map((row) => row.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <table
                    style={{
                      minWidth: '100%',
                      width: '100%',
                      display: 'table',
                    }}
                    className={`table-compact ${
                      tableSize === 'compact'
                        ? 'table-compact'
                        : tableSize === 'large'
                          ? 'table-large'
                          : ''
                    }`}
                  >
                    <TableHeader
                      className={`top-0 z-10 !bg-background ${headerPinned ? 'sticky' : ''}`}
                    >
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow
                          key={headerGroup.id}
                          style={{ display: 'flex', width: '100%' }}
                        >
                          {isUnlocked && (
                            <TableHead
                              style={{
                                flex: '0 0 24px',
                                width: '24px',
                                padding: 0,
                              }}
                            />
                          )}
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

                    {/* Loading skeleton — rendered as a normal tbody, bypasses
                      virtualization since we just showplaceholders. */}
                    {isLoading && (
                      <TableBody>
                        {Array.from({ length: pagination.pageSize }).map(
                          (_, i) => (
                            <TableRow
                              key={i}
                              style={{ display: 'flex', width: '100%' }}
                            >
                              {isUnlocked && (
                                <TableCell
                                  style={{
                                    flex: '0 0 24px',
                                    width: '24px',
                                    padding: 0,
                                  }}
                                />
                              )}
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
                          )
                        )}
                      </TableBody>
                    )}

                    {/* Empty state */}
                    {!isLoading && rows.length === 0 && (
                      <TableBody>
                        <TableRow style={{ display: 'flex', width: '100%' }}>
                          <TableCell
                            style={{ flex: '1 1 100%', width: '100%' }}
                            colSpan={columns.length + (isUnlocked ? 1 : 0)}
                            className="h-24 text-center"
                          >
                            No channels found
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    )}

                    {/* Virtualized rows.
                      Each channel row (plus its optional expanded sub-row) is
                      wrapped in its own <tbody>.  A <table> may contain multiple
                      <tbody> elements — this is valid HTML and lets the
                      ResizeObserver measure the combined height of the main row
                      AND the (variable-height) expanded row as a single unit,
                      which is exactly what the virtualizer needs for dynamic
                      sizing.  DnD is unaffected: SortableContext holds all IDs
                      and useSortable runs inside each rendered DraggableRow. */}
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
                              <DraggableRow row={row} />
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
                </SortableContext>
              </DndContext>
            </div>
            {/* end scrollable container */}
          </div>
          {/* end relative skeleton wrapper */}

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

      <ChannelForm
        channel={editingChannel}
        isOpen={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
      />

      <AssignChannelNumbersForm
        channelIds={selectedChannelIds}
        isOpen={assignNumbersModalOpen}
        onClose={() => setAssignNumbersModalOpen(false)}
      />

      <EPGMatchForm
        isOpen={epgMatchModalOpen}
        onClose={() => setEpgMatchModalOpen(false)}
        channelIds={selectedChannelIds}
      />

      <ProfileForm
        isOpen={profileModalState.opened}
        onClose={() =>
          setProfileModalState({ ...profileModalState, opened: false })
        }
        mode={profileModalState.mode}
        profile={
          profileModalState.profileId
            ? profiles[profileModalState.profileId]
            : null
        }
      />

      <ConfirmationDialog
        opened={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={() =>
          isBulkDelete
            ? executeDeleteChannels()
            : executeDeleteChannel(deleteTarget)
        }
        loading={deleting}
        title={`Confirm ${isBulkDelete ? 'Bulk ' : ''}Channel Deletion`}
        message={
          isBulkDelete ? (
            `Are you sure you want to delete ${selectedChannelIds.length} channels? This action cannot be undone.`
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

      <ConfirmationDialog
        opened={confirmDeleteProfileOpen}
        onClose={() => setConfirmDeleteProfileOpen(false)}
        onConfirm={() => executeDeleteProfile(profileToDelete?.id)}
        loading={deletingProfile}
        title="Confirm Profile Deletion"
        message={
          profileToDelete ? (
            <div style={{ whiteSpace: 'pre-line' }}>
              {`Are you sure you want to delete the following profile?

Name: ${profileToDelete.name}

This action cannot be undone.`}
            </div>
          ) : (
            'Are you sure you want to delete this profile? This action cannot be undone.'
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        actionKey="delete-profile"
        onSuppressChange={suppressWarning}
        size="md"
      />

      <ChannelRecordingForm
        channel={channel}
        isOpen={recordingModalOpen}
        onClose={() => setRecordingModalOpen(false)}
      />

      <GroupManager
        isOpen={groupManagerOpen}
        onClose={() => setGroupManagerOpen(false)}
      />
    </div>
  );
}
