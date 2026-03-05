// Modal.js
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import API from '@/lib/api';
import useChannelsStore from '@/store/channels';
import useStreamProfilesStore from '@/store/streamProfiles';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const schema = Yup.object({
  name: Yup.string().required('Name is required'),
  url: Yup.string().required('URL is required').min(0),
});

const Stream = ({ stream = null, isOpen, onClose }) => {
  const streamProfiles = useStreamProfilesStore((state) => state.profiles);
  const channelGroups = useChannelsStore((s) => s.channelGroups);

  const defaultValues = useMemo(
    () => ({
      name: stream?.name || '',
      url: stream?.url || '',
      channel_group: stream?.channel_group
        ? String(stream.channel_group)
        : null,
      stream_profile_id: stream?.stream_profile_id
        ? String(stream.stream_profile_id)
        : '',
    }),
    [stream]
  );

  const groupsById = {};
  const groupsByName = Object.values(channelGroups).reduce((acc, group) => {
    acc[group.name] = group;
    groupsById[group.id] = group;
    return acc;
  }, {});

  const profilesById = {};
  const profilesByName = streamProfiles.reduce((acc, profile) => {
    acc[profile.name] = profile;
    profilesById[profile.id] = profile;
    return acc;
  }, {});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
    control,
  } = useForm({
    defaultValues,
    resolver: yupResolver(schema),
  });

  const onSubmit = async (values) => {
    console.log(values);

    // Convert string IDs back to integers for the API
    const payload = {
      ...values,
      channel_group: values.channel_group
        ? parseInt(values.channel_group, 10)
        : null,
      stream_profile_id: values.stream_profile_id
        ? parseInt(values.stream_profile_id, 10)
        : null,
    };

    if (stream?.id) {
      await API.updateStream({ id: stream.id, ...payload });
    } else {
      await API.addStream(payload);
    }

    reset();
    onClose();
  };

  const handleChannelGroupSelect = (value) => {
    console.log(value);
    setValue('channel_group', groupsByName[value].id);
  };

  const handleStreamProfileSelect = (value) => {
    setValue('stream_profile_id', profilesByName[value].id);
  };

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  if (!isOpen) {
    return <></>;
  }

  const channelGroupValue = watch('channel_group');
  const streamProfileValue = watch('stream_profile_id');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Stream</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2 pb-4">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <div className="space-y-1">
                  <Label>Stream Name</Label>
                  <Input
                    {...field}
                    type="text"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                  />
                </div>
              )}
            />

            <Controller
              name="url"
              control={control}
              render={({ field }) => (
                <div className="space-y-1">
                  <Label>URL</Label>
                  <Input
                    {...field}
                    type="text"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                  />
                </div>
              )}
            />

            <Controller
              name="channel_group"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-1">
                  <Label>Group</Label>
                  <Combobox
                    items={Object.values(channelGroups).map(
                      (group) => group.name
                    )}
                    onValueChange={handleChannelGroupSelect}
                    defaultValue={groupsById[field.value]?.name || ''}
                  >
                    <ComboboxInput />
                    <ComboboxContent>
                      <ComboboxEmpty>No items found.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.error && (
                    <p className="text-sm text-red-500">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />

            <Controller
              name="stream_profile_id"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-1">
                  <Label>Stream Profile</Label>
                  <Combobox
                    items={Object.values(streamProfiles).map(
                      (profile) => profile.name
                    )}
                    onValueChange={handleStreamProfileSelect}
                    defaultValue={profilesById[field.value]?.name || ''}
                  >
                    <ComboboxInput />
                    <ComboboxContent>
                      <ComboboxEmpty>No items found.</ComboboxEmpty>
                      <ComboboxList>
                        {(item) => (
                          <ComboboxItem key={item} value={item}>
                            {item}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {fieldState.error && (
                    <p className="text-sm text-red-500">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
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
        </form>
      </DialogContent>
    </Dialog>

    // <Modal opened={isOpen} onClose={onClose} title="Stream" zIndex={10}>
    //   <form onSubmit={handleSubmit(onSubmit)}>
    //     <TextInput
    //       label="Stream Name"
    //       {...register('name')}
    //       error={errors.name?.message}
    //     />

    //     <TextInput
    //       label="Stream URL"
    //       {...register('url')}
    //       error={errors.url?.message}
    //     />

    //     <Select
    //       label="Group"
    //       searchable
    //       value={channelGroupValue}
    //       onChange={(value) => setValue('channel_group', value)}
    //       error={errors.channel_group?.message}
    //       data={Object.values(channelGroups).map((group) => ({
    //         label: group.name,
    //         value: `${group.id}`,
    //       }))}
    //     />

    //     <Select
    //       label="Stream Profile"
    //       placeholder="Optional"
    //       searchable
    //       value={streamProfileValue}
    //       onChange={(value) => setValue('stream_profile_id', value)}
    //       error={errors.stream_profile_id?.message}
    //       data={streamProfiles.map((profile) => ({
    //         label: profile.name,
    //         value: `${profile.id}`,
    //       }))}
    //       comboboxProps={{ withinPortal: false, zIndex: 1000 }}
    //     />

    //     <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
    //       <Button
    //         type="submit"
    //         variant="contained"
    //         color="primary"
    //         disabled={isSubmitting}
    //       >
    //         Submit
    //       </Button>
    //     </Flex>
    //   </form>
    // </Modal>
  );
};

export default Stream;
