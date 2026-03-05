import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import React, { useState } from 'react';

const CreateChannelFromStreamForm = ({
  opened,
  onClose,
  mode,
  onModeChange,
  numberValue,
  onNumberValueChange,
  rememberChoice,
  onRememberChoiceChange,
  onConfirm,
  // Props for customizing the modal behavior
  isBulk = false,
  streamCount = 1,
  streamName = '',
  // Channel profile props
  selectedProfileIds,
  onProfileIdsChange,
  channelProfiles = [],
}) => {
  const title = isBulk ? 'Create Channels Options' : 'Create Channel';
  const confirmLabel = isBulk ? 'Create Channels' : 'Create Channel';
  const numberingLabel = isBulk ? 'Numbering Mode' : 'Number Assignment';

  const [selected, setSelected] = useState([]);

  const anchor = useComboboxAnchor();

  // For bulk: use 'custom' mode, for single: use 'specific' mode
  const customModeValue = isBulk ? 'custom' : 'specific';

  const profilesById = {
    all: { id: 'all', name: 'All' },
    none: { id: 'none', name: 'No Profiles' },
    // Specific profiles will be added dynamically below
    ...channelProfiles.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {}),
  };
  const profilesByName = {
    'No Profiles': { id: 'none', name: 'No Profiles' },
    // Specific profiles will be added dynamically below
    ...channelProfiles.reduce((acc, profile) => {
      acc[profile.name] = profile;
      return acc;
    }, {}),
  };

  const profileOptions = [
    {
      value: 'Special',
      items: ['All Profiles', 'No Profiles'],
    },
    {
      value: 'Profiles',
      items: channelProfiles
        .filter((profile) => profile.id.toString() !== '0')
        .map((profile) => profile.name),
    },
  ];

  // Handle profile selection with mutual exclusivity
  const handleProfileChange = (newValue) => {
    const newValueIds = newValue
      .map((val) => {
        if (val === 'All Profiles') return 'all';
        return profilesByName[val]?.id;
      })
      .filter(Boolean);
    const lastSelected = newValueIds[newValueIds.length - 1];

    // If 'all' or 'none' was just selected, clear everything else and keep only that
    if (lastSelected === 'all' || lastSelected === 'none') {
      onProfileIdsChange([lastSelected]);
    }
    // If a specific profile was selected, remove 'all' and 'none'
    else if (newValueIds.includes('all') || newValueIds.includes('none')) {
      onProfileIdsChange(
        newValueIds.filter((v) => v !== 'all' && v !== 'none')
      );
    }
    // Otherwise just update normally
    else {
      onProfileIdsChange(newValueIds);
    }
  };

  return (
    <Dialog
      open={opened}
      onOpenChange={onClose}
      modal={false} // This is a known bug, Combobox won't work in dialog if it's modal={true}: https://github.com/shadcn-ui/ui/issues/9712
    >
      <DialogContent className="">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Configure options for creating ${streamCount} channels from selected streams:`
              : `Configure options for creating a channel from "${streamName}":`}
          </DialogDescription>
        </DialogHeader>

        <Combobox
          multiple
          autoHighlight
          items={profileOptions}
          value={selectedProfileIds
            .map((id) =>
              id === 'all' ? 'All Profiles' : profilesById[id]?.name
            )
            .filter(Boolean)}
          onValueChange={handleProfileChange}
        >
          <ComboboxChips ref={anchor} className="w-full max-w-xs">
            <ComboboxValue>
              {(values) => (
                <React.Fragment>
                  {values.map((value: string) => (
                    <ComboboxChip key={value}>{value}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput />
                </React.Fragment>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent className="min-w-[200px]">
            <ComboboxEmpty>No profiles found.</ComboboxEmpty>
            <ComboboxList>
              {(group, index) => (
                <ComboboxGroup key={group.value} items={group.items}>
                  <ComboboxLabel>{group.value}</ComboboxLabel>
                  <ComboboxCollection>
                    {(item) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                  {index < profileOptions.length - 1 && <ComboboxSeparator />}
                </ComboboxGroup>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>

        <Separator />

        <FieldSet className="w-full">
          <FieldLegend variant="label">Channel Numbering Mode</FieldLegend>
          <RadioGroup
            value={mode}
            onValueChange={onModeChange}
            className="max-w-sm"
          >
            <FieldLabel htmlFor="provider">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    {isBulk ? 'Use Provider Numbers' : 'Use Provider Number'}
                  </FieldTitle>
                  <FieldDescription>
                    {isBulk
                      ? 'Use tvg-chno or channel-number from stream metadata, auto-assign for conflicts'
                      : 'Use tvg-chno or channel-number from stream metadata, auto-assign if not available'}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem value="provider" id="provider" />
              </Field>
            </FieldLabel>

            <FieldLabel htmlFor="auto">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    {isBulk
                      ? 'Auto-Assign Sequential'
                      : 'Auto-Assign Next Available'}
                  </FieldTitle>
                  <FieldDescription>
                    {isBulk
                      ? 'Start from the lowest available channel number and increment by 1'
                      : 'Automatically assign the next available channel number'}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem value="auto" id="auto" />
              </Field>
            </FieldLabel>

            <FieldLabel htmlFor="custom">
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>
                    {isBulk
                      ? 'Start from Custom Number'
                      : 'Use Specific Number'}
                  </FieldTitle>
                  <FieldDescription>
                    {isBulk
                      ? 'Start sequential numbering from a specific channel number'
                      : 'Use a specific channel number'}
                  </FieldDescription>
                </FieldContent>
                <RadioGroupItem value={customModeValue} id="custom" />
              </Field>
            </FieldLabel>
          </RadioGroup>
        </FieldSet>

        {mode === customModeValue && (
          <Field>
            <FieldLabel htmlFor="custom-value">
              {isBulk ? 'Starting Channel Number' : 'Channel Number'}
            </FieldLabel>
            <Input
              id="custom-value"
              type="number"
              min={1}
              value={numberValue}
              onChange={(e) => onNumberValueChange(e.target.value)}
              placeholder={
                isBulk ? 'Enter starting number...' : 'Enter channel number...'
              }
            />
            <FieldDescription>
              {isBulk
                ? 'Channel numbers will be assigned starting from this number'
                : 'The specific channel number to assign'}
            </FieldDescription>
          </Field>
        )}

        <Field orientation="horizontal">
          <Checkbox
            id="remember-selection"
            name="remember-selection"
            checked={rememberChoice}
            onCheckedChange={onRememberChoiceChange}
          />
          <FieldLabel htmlFor="remember-selection">
            Remember this choice and don't ask again
          </FieldLabel>
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    //   <Modal opened={opened} onClose={onClose} title={title} size="md" centered>
    //     <Stack spacing="md">
    //       <Text size="sm" c="dimmed">
    //         {isBulk
    //           ? `Configure options for creating ${streamCount} channels from selected streams:`
    //           : `Configure options for creating a channel from "${streamName}":`}
    //       </Text>

    //       <Divider label="Channel Profiles" labelPosition="left" />

    //       <MultiSelect
    //         label="Channel Profiles"
    //         description="Select 'All Profiles' to add to all profiles, 'No Profiles' to not add to any profile, or choose specific profiles"
    //         placeholder="Select profiles..."
    //         data={profileOptions}
    //         value={selectedProfileIds}
    //         onChange={handleProfileChange}
    //         searchable
    //         clearable
    //       />

    //       <Divider label="Channel Number" labelPosition="left" />

    //        .Group
    //         value={mode}
    //         onChange={onModeChange}
    //         label={numberingLabel}
    //       >
    //         <Stack mt="xs" spacing="xs">
    //           <Radio
    //             value="provider"
    //             label={isBulk ? 'Use Provider Numbers' : 'Use Provider Number'}
    //             description={
    //               isBulk
    //                 ? 'Use tvg-chno or channel-number from stream metadata, auto-assign for conflicts'
    //                 : 'Use tvg-chno or channel-number from stream metadata, auto-assign if not available'
    //             }
    //           />
    //           <Radio
    //             value="auto"
    //             label={
    //               isBulk ? 'Auto-Assign Sequential' : 'Auto-Assign Next Available'
    //             }
    //             description={
    //               isBulk
    //                 ? 'Start from the lowest available channel number and increment by 1'
    //                 : 'Automatically assign the next available channel number'
    //             }
    //           />
    //           <Radio
    //             value={customModeValue}
    //             label={
    //               isBulk ? 'Start from Custom Number' : 'Use Specific Number'
    //             }
    //             description={
    //               isBulk
    //                 ? 'Start sequential numbering from a specific channel number'
    //                 : 'Use a specific channel number'
    //             }
    //           />
    //         </Stack>
    //       </Radio.Group>

    //       {mode === customModeValue && (
    //         <NumberInput
    //           label={isBulk ? 'Starting Channel Number' : 'Channel Number'}
    //           description={
    //             isBulk
    //               ? 'Channel numbers will be assigned starting from this number'
    //               : 'The specific channel number to assign'
    //           }
    //           value={numberValue}
    //           onChange={onNumberValueChange}
    //           min={1}
    //           placeholder={
    //             isBulk ? 'Enter starting number...' : 'Enter channel number...'
    //           }
    //         />
    //       )}

    //       <Checkbox
    //         checked={rememberChoice}
    //         onChange={(event) =>
    //           onRememberChoiceChange(event.currentTarget.checked)
    //         }
    //         label="Remember this choice and don't ask again"
    //       />

    //       <Group justify="flex-end" mt="md">
    //         <Button variant="default" onClick={onClose}>
    //           Cancel
    //         </Button>
    //         <Button onClick={onConfirm}>{confirmLabel}</Button>
    //       </Group>
    //     </Stack>
    //   </Modal>
  );
};

export default CreateChannelFromStreamForm;
