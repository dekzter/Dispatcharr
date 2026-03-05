import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChannelLogoSelection } from '@/hooks/use-smart-logos';
import API from '@/lib/api';
import { USER_LEVELS, USER_LEVEL_LABELS } from '@/lib/constants';
import toast from '@/lib/toast';
import useChannelsStore from '@/store/channels';
import useEPGsStore from '@/store/epgs';
import useLogosStore from '@/store/logos';
import useStreamProfilesStore from '@/store/streamProfiles';
import { yupResolver } from '@hookform/resolvers/yup';
import { ListOrdered } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { List } from 'react-window';
import * as Yup from 'yup';
import LogoForm from './LogoForm';

const validationSchema = Yup.object({
  name: Yup.string().required('Name is required'),
  channel_group_id: Yup.string().required('Channel group is required'),
});

export default function ChannelForm({ channel, isOpen, onClose }: any) {
  const listRef = useRef(null);
  const logoListRef = useRef(null);
  const groupListRef = useRef(null);

  const channelGroups = useChannelsStore((s) => s.channelGroups);

  const {
    logos: channelLogos,
    ensureLogosLoaded,
    isLoading: logosLoading,
  } = useChannelLogoSelection();

  // Import the full logos store for duplicate checking
  const allLogos = useLogosStore((s) => s.logos);

  // Ensure logos are loaded when component mounts
  useEffect(() => {
    ensureLogosLoaded();
  }, [ensureLogosLoaded]);

  const streamProfiles = useStreamProfilesStore((s) => s.profiles);
  const epgs = useEPGsStore((s) => s.epgs);
  const tvgs = useEPGsStore((s) => s.tvgs);
  const tvgsById = useEPGsStore((s) => s.tvgsById);

  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [channelStreams, setChannelStreams] = useState([]);
  const [channelGroupModelOpen, setChannelGroupModalOpen] = useState(false);
  const [epgPopoverOpened, setEpgPopoverOpened] = useState(false);
  const [logoPopoverOpened, setLogoPopoverOpened] = useState(false);
  const [selectedEPG, setSelectedEPG] = useState('');
  const [tvgFilter, setTvgFilter] = useState('');
  const [logoFilter, setLogoFilter] = useState('');

  const [groupPopoverOpened, setGroupPopoverOpened] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const groupOptions = Object.values(channelGroups);

  const handleLogoSuccess = ({ logo }) => {
    if (logo && logo.id) {
      setValue('logo_id', logo.id);
      ensureLogosLoaded(); // Refresh logos
    }
    setLogoModalOpen(false);
  };

  const handleAutoMatchEpg = async () => {
    // Only attempt auto-match for existing channels (editing mode)
    if (!channel || !channel.id) {
      toast.show({
        title: 'Info',
        message: 'Auto-match is only available when editing existing channels.',
        color: 'blue',
      });
      return;
    }

    setAutoMatchLoading(true);
    try {
      const response = await API.matchChannelEpg(channel.id);

      if (response.matched) {
        // Update the form with the new EPG data
        if (response.channel && response.channel.epg_data_id) {
          setValue('epg_data_id', response.channel.epg_data_id);
        }

        toast.show({
          title: 'Success',
          message: response.message,
          color: 'green',
        });
      } else {
        toast.show({
          title: 'No Match Found',
          message: response.message,
          color: 'orange',
        });
      }
    } catch (error) {
      toast.show({
        title: 'Error',
        message: 'Failed to auto-match EPG data',
        color: 'red',
      });
      console.error('Auto-match error:', error);
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const handleSetNameFromEpg = () => {
    const epgDataId = watch('epg_data_id');
    if (!epgDataId) {
      toast.show({
        title: 'No EPG Selected',
        message: 'Please select an EPG source first.',
        color: 'orange',
      });
      return;
    }

    const tvg = tvgsById[epgDataId];
    if (tvg && tvg.name) {
      setValue('name', tvg.name);
      toast.show({
        title: 'Success',
        message: `Channel name set to "${tvg.name}"`,
        color: 'green',
      });
    } else {
      toast.show({
        title: 'No Name Available',
        message: 'No name found in the selected EPG data.',
        color: 'orange',
      });
    }
  };

  const handleSetLogoFromEpg = async () => {
    const epgDataId = watch('epg_data_id');
    if (!epgDataId) {
      toast.show({
        title: 'No EPG Selected',
        message: 'Please select an EPG source first.',
        color: 'orange',
      });
      return;
    }

    const tvg = tvgsById[epgDataId];
    if (!tvg || !tvg.icon_url) {
      toast.show({
        title: 'No EPG Icon',
        message: 'EPG data does not have an icon URL.',
        color: 'orange',
      });
      return;
    }

    try {
      // Try to find a logo that matches the EPG icon URL - check ALL logos to avoid duplicates
      let matchingLogo = Object.values(allLogos).find(
        (logo) => logo.url === tvg.icon_url
      );

      if (matchingLogo) {
        setValue('logo_id', matchingLogo.id);
        toast.show({
          title: 'Success',
          message: `Logo set to "${matchingLogo.name}"`,
          color: 'green',
        });
      } else {
        // Logo doesn't exist - create it
        toast.show({
          id: 'creating-logo',
          title: 'Creating Logo',
          message: `Creating new logo from EPG icon URL...`,
          loading: true,
        });

        try {
          const newLogoData = {
            name: tvg.name || `Logo for ${tvg.icon_url}`,
            url: tvg.icon_url,
          };

          // Create logo by calling the Logo API directly
          const newLogo = await API.createLogo(newLogoData);

          setValue('logo_id', newLogo.id);

          toast.update({
            id: 'creating-logo',
            title: 'Success',
            message: `Created and assigned new logo "${newLogo.name}"`,
            loading: false,
            color: 'green',
            autoClose: 5000,
          });
        } catch (createError) {
          toast.update({
            id: 'creating-logo',
            title: 'Error',
            message: 'Failed to create logo from EPG icon URL',
            loading: false,
            color: 'red',
            autoClose: 5000,
          });
          throw createError;
        }
      }
    } catch (error) {
      toast.show({
        title: 'Error',
        message: 'Failed to set logo from EPG data',
        color: 'red',
      });
      console.error('Set logo from EPG error:', error);
    }
  };

  const handleSetTvgIdFromEpg = () => {
    const epgDataId = watch('epg_data_id');
    if (!epgDataId) {
      toast.show({
        title: 'No EPG Selected',
        message: 'Please select an EPG source first.',
        color: 'orange',
      });
      return;
    }

    const tvg = tvgsById[epgDataId];
    if (tvg && tvg.tvg_id) {
      setValue('tvg_id', tvg.tvg_id);
      toast.show({
        title: 'Success',
        message: `TVG-ID set to "${tvg.tvg_id}"`,
        color: 'green',
      });
    } else {
      toast.show({
        title: 'No TVG-ID Available',
        message: 'No TVG-ID found in the selected EPG data.',
        color: 'orange',
      });
    }
  };

  const defaultValues = useMemo(
    () => ({
      name: channel?.name || '',
      channel_number:
        channel?.channel_number !== null &&
        channel?.channel_number !== undefined
          ? channel.channel_number
          : '',
      channel_group_id: channel?.channel_group_id
        ? `${channel.channel_group_id}`
        : Object.keys(channelGroups).length > 0
          ? Object.keys(channelGroups)[0]
          : '',
      stream_profile_id: channel?.stream_profile_id
        ? `${channel.stream_profile_id}`
        : '0',
      tvg_id: channel?.tvg_id || '',
      tvc_guide_stationid: channel?.tvc_guide_stationid || '',
      epg_data_id: channel?.epg_data_id ?? '',
      logo_id: channel?.logo_id ? `${channel.logo_id}` : '',
      user_level: `${channel?.user_level ?? '0'}`,
      is_adult: channel?.is_adult ?? false,
    }),
    [channel, channelGroups]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm({
    defaultValues,
    resolver: yupResolver(validationSchema),
  });

  const onSubmit = async (e) => {
    e.preventDefault()
    const values = getValues()
    console.log(values)

    let response;

    try {
      const formattedValues = { ...values };

      // Convert empty or "0" stream_profile_id to null for the API
      if (
        !formattedValues.stream_profile_id ||
        formattedValues.stream_profile_id === '0'
      ) {
        formattedValues.stream_profile_id = null;
      }

      // Ensure tvg_id is properly included (no empty strings)
      formattedValues.tvg_id = formattedValues.tvg_id || null;

      // Ensure tvc_guide_stationid is properly included (no empty strings)
      formattedValues.tvc_guide_stationid =
        formattedValues.tvc_guide_stationid || null;

      if (channel) {
        // If there's an EPG to set, use our enhanced endpoint
        if (values.epg_data_id !== (channel.epg_data_id ?? '')) {
          // Use the special endpoint to set EPG and trigger refresh
          const epgResponse = await API.setChannelEPG(
            channel.id,
            values.epg_data_id
          );

          // Remove epg_data_id from values since we've handled it separately
          const { epg_data_id, ...otherValues } = formattedValues;

          // Update other channel fields if needed
          if (Object.keys(otherValues).length > 0) {
            response = await API.updateChannel({
              id: channel.id,
              ...otherValues,
              streams: channelStreams.map((stream) => stream.id),
            });
          }
        } else {
          // No EPG change, regular update
          response = await API.updateChannel({
            id: channel.id,
            ...formattedValues,
            streams: channelStreams.map((stream) => stream.id),
          });
        }
      } else {
        // New channel creation - use the standard method
        response = await API.addChannel({
          ...formattedValues,
          streams: channelStreams.map((stream) => stream.id),
        });
      }
    } catch (error) {
      console.error('Error saving channel:', error);
    }

    reset();
    API.requeryChannels();

    // Refresh channel profiles to update the membership information
    useChannelsStore.getState().fetchChannelProfiles();

    setTvgFilter('');
    setLogoFilter('');
    onClose();
  };

  useEffect(() => {
    reset(defaultValues);
    setChannelStreams(channel?.streams || []);

    if (channel?.epg_data_id) {
      const epgSource = epgs[tvgsById[channel.epg_data_id]?.epg_source];
      setSelectedEPG(epgSource ? `${epgSource.id}` : '');
    } else {
      setSelectedEPG('');
    }

    if (!channel) {
      setTvgFilter('');
      setLogoFilter('');
    }
  }, [defaultValues, channel, reset, epgs, tvgsById]);

  // Memoize logo options to prevent infinite re-renders during background loading
  const logoOptions = useMemo(() => {
    const options = [{ id: '0', name: 'Default' }].concat(
      Object.values(channelLogos)
    );
    return options;
  }, [channelLogos]); // Only depend on channelLogos object

  // Update the handler for when channel group modal is closed
  const handleChannelGroupModalClose = (newGroup) => {
    setChannelGroupModalOpen(false);

    // If a new group was created and returned, update the form with it
    if (newGroup && newGroup.id) {
      // Preserve all current form values while updating just the channel_group_id
      setValue('channel_group_id', `${newGroup.id}`);
    }
  };

  if (!isOpen) {
    return <></>;
  }

  const filteredTvgs = tvgs
    .filter((tvg) => tvg.epg_source == selectedEPG)
    .filter(
      (tvg) =>
        tvg.name.toLowerCase().includes(tvgFilter.toLowerCase()) ||
        tvg.tvg_id.toLowerCase().includes(tvgFilter.toLowerCase())
    );

  const filteredLogos = logoOptions.filter((logo) =>
    logo.name.toLowerCase().includes(logoFilter.toLowerCase())
  );

  const filteredGroups = groupOptions.filter((group) =>
    group.name.toLowerCase().includes(groupFilter.toLowerCase())
  );

  // Row renderer for react-window List
  const GroupRow = ({ index, filteredGroups, style }) => {
    const group = filteredGroups[index];
    return (
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div
            style={style}
            role="button"
            onClick={() => {
              setValue('channel_group_id', group.id);
              setChannelGroupModalOpen(false);
              setGroupPopoverOpened(false);
            }}
            className="whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:bg-muted/50 py-1 text-sm"
          >
            {group.name}
          </div>
        </TooltipTrigger>
        <TooltipContent>{group.name}</TooltipContent>
      </Tooltip>
    );
  };

  const LogoRow = ({ index, filteredLogos, style }) => {
    const logo = filteredLogos[index];
    return (
      <div
        style={style}
        onClick={() => {
          setValue('logo_id', filteredLogos[index].id);
          setLogoPopoverOpened(false);
        }}
        // onMouseEnter={(e) => {
        //   e.currentTarget.style.backgroundColor = 'rgb(68, 68, 68)';
        // }}
        // onMouseLeave={(e) => {
        //   e.currentTarget.style.backgroundColor = 'transparent';
        // }}
      >
        <div className="cursor-pointer hover:bg-secondary flex flex-col items-center justify-center gap-2">
          <img
            className="h-[30px] max-w-[80px]"
            src={filteredLogos[index].cache_url || logo.url}
            style={{ maxWidth: 80, objectFit: 'contain' }}
            alt={filteredLogos[index].name || 'Logo'}
            onError={(e) => {
              // Fallback to default logo if image fails to load
              if (e.target.src !== logo) {
                e.target.src = logo;
              }
            }}
          />
          <div className="text-xs text-center overflow-hidden overflow-ellipsis whitespace-nowrap">
            {filteredLogos[index].name || 'Default'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5" />
            Channels
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col gap-4 h-full w-full">
                <div className="space-y-1">
                  <Label htmlFor="channel-name" className="">
                    Channel Name
                    {watch('epg_data_id') && (
                      <div
                        className="cursor-pointer text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetNameFromEpg();
                        }}
                      >
                        Use EPG Name
                      </div>
                    )}
                  </Label>
                  <Input
                    id="channel-name"
                    type="text"
                    required
                    {...register('name')}
                  />
                </div>

                <div className="space-y-0">
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <div>
                        <Label htmlFor="channel-group" className=" pb-1 ">
                          Channel Group
                        </Label>
                        <div
                          className="border-1 p-2 bg-secondary/50 rounded-md border-input flex items-center justify-between cursor-pointer text-sm"
                          onClick={() => setGroupPopoverOpened(true)}
                        >
                          {channelGroups[watch('channel_group_id')]
                            ? channelGroups[watch('channel_group_id')].name
                            : ''}
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent>
                      <div>
                        <Input
                          id="channel-group"
                          value={groupFilter}
                          onChange={(e) => setGroupFilter(e.target.value)}
                          placeholder="Filter"
                        />

                        <div className="h-[200px] pt-2 z-1000">
                          <List
                            rowCount={filteredGroups.length}
                            rowHeight={35}
                            rowComponent={GroupRow}
                            rowProps={{ filteredGroups }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="stream-profile" className="">
                    Stream Profile
                  </Label>
                  <Select
                    value={watch('stream_profile_id')}
                    onValueChange={(value) => {
                      setValue('stream_profile_id', value);
                    }}
                  >
                    <SelectTrigger id="stream-profile" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[{ value: '0', label: '(use default)' }]
                        .concat(
                          streamProfiles.map((option) => ({
                            value: `${option.id}`,
                            label: option.name,
                          }))
                        )
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="user-level-access" className="">
                    User Level Access
                  </Label>
                  <Select
                    value={watch('user_level_access')}
                    onValueChange={(value) => {
                      setValue('user_level_access', value);
                    }}
                  >
                    <SelectTrigger id="user-level-access" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(USER_LEVELS)
                        .map(([, value]) => {
                          return {
                            label: USER_LEVEL_LABELS[value],
                            value: `${value}`,
                          };
                        })
                        .map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator orientation="vertical" className="!h-[250px]" />

              <div className="flex flex-col justify-start items-start gap-4 h-full w-full">
                <div className="w-full">
                  <Popover modal={true}>
                    <PopoverTrigger asChild>
                      <div>
                        <Label htmlFor="channel-group" className=" pb-1 ">
                          Logo
                          <div
                            className="cursor-pointer text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetLogoFromEpg();
                            }}
                          >
                            Use EPG Logo
                          </div>
                        </Label>
                        <div
                          className="border-1 p-2 bg-secondary/50 rounded-md border-input flex items-center justify-between cursor-pointer text-sm"
                          onClick={() => setGroupPopoverOpened(true)}
                        >
                          {channelLogos[watch('logo_id')]?.name || 'Default'}
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent>
                      <div>
                        <Input
                          id="logo-filter"
                          value={logoFilter}
                          onChange={(e) => setLogoFilter(e.target.value)}
                          placeholder="Filter"
                        />

                        <div className="h-[200px] pt-2 z-1000">
                          {logosLoading && 'Loading...'}
                          {!logosLoading && (
                            <List
                              rowCount={filteredLogos.length}
                              rowHeight={55}
                              rowComponent={LogoRow}
                              rowProps={{ filteredLogos }}
                            />
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLogoModalOpen(true);
                  }}
                >
                  Upload or Create Logo
                </Button>

                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <div className="flex justify-between items-center gap-2 cursor-pointer">
                      <Switch
                        id="mature-content"
                        checked={watch('is_adult')}
                        onCheckedChange={(value) => setValue('is_adult', value)}
                      />
                      <Label htmlFor="mature-content" className="">
                        Mature Content
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Mark as mature/adult content (18+)
                  </TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="!h-[200px]" />

              <div className="flex flex-col justify-start items-start gap-4 h-full w-full">
                <Controller
                  name="channel-number"
                  validater={(value) => {
                    if (value === '') return true; // Allow blank for auto-assign
                    const number = parseInt(value, 10);
                    return !isNaN(number) && number > 0;
                  }}
                  control={control}
                  render={({ field }) => (
                    <div className="w-full space-y-1">
                      <Label htmlFor="channel-number" className="">
                        Channel # (blank to auto-assign)
                      </Label>
                      <Input
                        id="channel-number"
                        type="number"
                        min={1}
                        {...field}
                      />
                    </div>
                  )}
                />

                <Controller
                  name="tvg_id"
                  validater={(value) => {
                    if (value === '') return true; // Allow blank for auto-assign
                    const number = parseInt(value, 10);
                    return !isNaN(number) && number > 0;
                  }}
                  control={control}
                  render={({ field }) => (
                    <div className="w-full space-y-1">
                      <Label htmlFor="tvg_id" className="">
                        TVG ID
                        {watch('epg_data_id') && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={handleSetTvgIdFromEpg}
                            title="Set TVG-ID from EPG data"
                          >
                            Use EPG TVG-ID
                          </Button>
                        )}
                      </Label>
                      <Input id="tvg_id" {...register('tvg_id')} />
                    </div>
                  )}
                />

                <Controller
                  name="tvc_guide_stationid"
                  control={control}
                  render={({ field }) => (
                    <div className="w-full space-y-1">
                      <Label htmlFor="tvc_guide_stationid" className="">
                        Gracenote StationId
                      </Label>
                      <Input
                        id="tvc_guide_stationid"
                        {...register('tvc_guide_stationid')}
                      />
                    </div>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save
              </Button>
            </DialogFooter>
          </div>
        </form>

        <LogoForm
          isOpen={logoModalOpen}
          onClose={() => setLogoModalOpen(false)}
          onSuccess={handleLogoSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
