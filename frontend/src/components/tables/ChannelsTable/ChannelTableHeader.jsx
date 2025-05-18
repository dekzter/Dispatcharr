import React, { useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Flex,
  Group,
  NumberInput,
  Popover,
  Select,
  Text,
  TextInput,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  ArrowDown01,
  Binary,
  Check,
  CircleCheck,
  SquareMinus,
  SquarePlus,
} from 'lucide-react';
import API from '../../../api';
import { notifications } from '@mantine/notifications';
import useChannelsStore from '../../../store/channels';
import useAuthStore from '../../../store/auth';
import { USER_LEVELS } from '../../../constants';

const CreateProfilePopover = React.memo(() => {
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');
  const theme = useMantineTheme();

  const authUser = useAuthStore((s) => s.user);

  const setOpen = () => {
    setName('');
    setOpened(!opened);
  };

  const submit = async () => {
    await API.addChannelProfile({ name });
    setName('');
    setOpened(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpen}
      position="bottom"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <ActionIcon
          variant="transparent"
          color={theme.tailwind.green[5]}
          onClick={setOpen}
          disabled={authUser.user_level != USER_LEVELS.ADMIN}
        >
          <SquarePlus />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown>
        <Group>
          <TextInput
            placeholder="Profile Name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            size="xs"
          />

          <ActionIcon
            variant="transparent"
            color={theme.tailwind.green[5]}
            size="sm"
            onClick={submit}
          >
            <CircleCheck />
          </ActionIcon>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
});

const ChannelTableHeader = ({
  rows,
  editChannel,
  deleteChannels,
  selectedTableIds,
}) => {
  const theme = useMantineTheme();

  const [channelNumAssignmentStart, setChannelNumAssignmentStart] = useState(1);

  const profiles = useChannelsStore((s) => s.profiles);
  const selectedProfileId = useChannelsStore((s) => s.selectedProfileId);
  const setSelectedProfileId = useChannelsStore((s) => s.setSelectedProfileId);
  const authUser = useAuthStore((s) => s.user);

  const deleteProfile = async (id) => {
    await API.deleteChannelProfile(id);
  };

  const matchEpg = async () => {
    try {
      // Hit our new endpoint that triggers the fuzzy matching Celery task
      await API.matchEpg();

      notifications.show({
        title: 'EPG matching task started!',
      });
    } catch (err) {
      notifications.show(`Error: ${err.message}`);
    }
  };

  const assignChannels = async () => {
    try {
      // Call our custom API endpoint
      const result = await API.assignChannelNumbers(
        selectedTableIds,
        channelNumAssignmentStart
      );

      // We might get { message: "Channels have been auto-assigned!" }
      notifications.show({
        title: result.message || 'Channels assigned',
        color: 'green.5',
      });

      // Refresh the channel list
      // await fetchChannels();
      API.requeryChannels();
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Failed to assign channels',
        color: 'red.5',
      });
    }
  };

  const renderProfileOption = ({ option, checked }) => {
    return (
      <Group justify="space-between" style={{ width: '100%' }}>
        <Box>{option.label}</Box>
        {option.value != '0' && (
          <ActionIcon
            size="xs"
            variant="transparent"
            color={theme.tailwind.red[6]}
            onClick={(e) => {
              e.stopPropagation();
              deleteProfile(option.value);
            }}
            disabled={authUser.user_level != USER_LEVELS.ADMIN}
          >
            <SquareMinus />
          </ActionIcon>
        )}
      </Group>
    );
  };

  return (
    <Group justify="space-between">
      <Group gap={5} style={{ paddingLeft: 10 }}>
        <Select
          size="xs"
          allowDeselect={false}
          value={selectedProfileId}
          onChange={setSelectedProfileId}
          data={Object.values(profiles).map((profile) => ({
            label: profile.name,
            value: `${profile.id}`,
          }))}
          renderOption={renderProfileOption}
        />

        <Tooltip label="Create Profile">
          <CreateProfilePopover />
        </Tooltip>
      </Group>

      <Box
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: 10,
        }}
      >
        <Flex gap={6}>
          <Button
            leftSection={<SquareMinus size={18} />}
            variant="default"
            size="xs"
            onClick={deleteChannels}
            disabled={
              selectedTableIds.length == 0 ||
              authUser.user_level != USER_LEVELS.ADMIN
            }
          >
            Remove
          </Button>

          <Tooltip label="Assign Channel #s">
            <Popover withArrow shadow="md">
              <Popover.Target>
                <Button
                  leftSection={<ArrowDown01 size={18} />}
                  variant="default"
                  size="xs"
                  p={5}
                  disabled={
                    selectedTableIds.length == 0 ||
                    authUser.user_level != USER_LEVELS.ADMIN
                  }
                >
                  Assign
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Group>
                  <Text>Start #</Text>
                  <NumberInput
                    value={channelNumAssignmentStart}
                    onChange={setChannelNumAssignmentStart}
                    size="small"
                    style={{ width: 50 }}
                  />
                  <ActionIcon
                    size="xs"
                    color={theme.tailwind.green[5]}
                    variant="transparent"
                    onClick={assignChannels}
                  >
                    <Check />
                  </ActionIcon>
                </Group>
              </Popover.Dropdown>
            </Popover>
          </Tooltip>

          <Tooltip label="Auto-Match EPG">
            <Button
              leftSection={<Binary size={18} />}
              variant="default"
              size="xs"
              onClick={matchEpg}
              p={5}
              disabled={authUser.user_level != USER_LEVELS.ADMIN}
            >
              Auto-Match
            </Button>
          </Tooltip>

          <Button
            leftSection={<SquarePlus size={18} />}
            variant="light"
            size="xs"
            onClick={() => editChannel()}
            disabled={authUser.user_level != USER_LEVELS.ADMIN}
            p={5}
            color={theme.tailwind.green[5]}
            style={{
              ...(authUser.user_level == USER_LEVELS.ADMIN && {
                borderWidth: '1px',
                borderColor: theme.tailwind.green[5],
                color: 'white',
              }),
            }}
          >
            Add
          </Button>
        </Flex>
      </Box>
    </Group>
  );
};

export default ChannelTableHeader;
